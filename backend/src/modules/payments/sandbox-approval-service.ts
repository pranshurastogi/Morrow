import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MorrowError } from "../../common/errors";
import { minorUnitsToDecimal } from "../../common/money";
import { getEnvironment } from "../../config/env";
import { writeAuditEvent } from "../../infrastructure/database/audit-repository";
import { getScanForUser } from "../../infrastructure/database/scan-repository";
import { getRedisConnection } from "../../infrastructure/queue/connection";
import {
  createPravaSession,
  extractCheckoutCredential,
  getPravaPaymentResult,
  reportPravaStatus,
} from "../../integrations/prava/client";
import { isPravaSandboxConfigured } from "../../integrations/prava/environment";
import { listOffersForUser } from "../offers/offer-repository";

const SANDBOX_CHECK_PREFIX = "sandbox:prava-approval:";
const SANDBOX_CLOSE_LOCK_PREFIX = "sandbox:prava-approval-close:";
const SANDBOX_CHECK_GRACE_SECONDS = 5 * 60;

const sandboxCheckRecordSchema = z.object({
  id: z.uuid(),
  userId: z.string().min(1),
  scanId: z.uuid(),
  productId: z.uuid(),
  offerId: z.uuid(),
  providerSessionId: z.string().min(1),
  providerOrderId: z.string().min(1),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  status: z.enum(["pending", "closing", "verified", "failed"]),
  providerStatus: z.enum(["pending", "awaiting_result", "completed", "failed"]),
  verifiedAt: z.iso.datetime().nullable(),
});

type SandboxCheckRecord = z.infer<typeof sandboxCheckRecordSchema>;

export interface SandboxApprovalStatus {
  status: "pending" | "verified" | "failed" | "expired";
  providerOrderId: string;
  orderPlaced: false;
  providerStatus: "pending" | "awaiting_result" | "completed" | "failed";
  milestones: {
    sessionCreated: true;
    cardAndPasskeyApproved: boolean;
    credentialIssued: boolean;
    merchantCheckout: "not_attempted";
    providerClosed: boolean;
  };
  message: string;
}

export interface SandboxApprovalClientEvent {
  event: "SDK_ERROR" | "SDK_DISMISSED" | "SESSION_REFRESH_FAILED";
  code: string;
  message: string;
  responseId: string | null;
  occurredAt: string;
  timezone: string;
  origin: string;
  capabilities: {
    secureContext: boolean;
    webAuthnAvailable: boolean;
    platformAuthenticatorAvailable: boolean | null;
  };
}

function key(id: string): string {
  return `${SANDBOX_CHECK_PREFIX}${id}`;
}

function ttlSeconds(expiresAt: string): number {
  const remaining = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / 1_000,
  );
  return Math.max(60, remaining + SANDBOX_CHECK_GRACE_SECONDS);
}

function sanitizeClientEventMessage(value: string): string {
  return value
    .replace(/\b(?:sk|pk)_(?:test|live)_[A-Za-z0-9_-]+\b/g, "[redacted key]")
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[redacted token]",
    )
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted number]")
    .slice(0, 400);
}

function assertSandboxConfigured(): void {
  if (!isPravaSandboxConfigured(getEnvironment())) {
    throw new MorrowError({
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "Prava sandbox approval checks are not configured",
      statusCode: 503,
    });
  }
}

async function save(record: SandboxCheckRecord): Promise<void> {
  await getRedisConnection().set(
    key(record.id),
    JSON.stringify(record),
    "EX",
    ttlSeconds(record.expiresAt),
  );
}

async function load(id: string, userId: string): Promise<SandboxCheckRecord> {
  const raw = await getRedisConnection().get(key(id));
  if (!raw) {
    throw new MorrowError({
      code: "PAYMENT_SESSION_EXPIRED",
      message: "This sandbox approval check has expired",
      statusCode: 410,
    });
  }
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    value = null;
  }
  const parsed = sandboxCheckRecordSchema.safeParse(value);
  if (!parsed.success || parsed.data.userId !== userId) {
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Sandbox approval check not found",
      statusCode: 404,
    });
  }
  return parsed.data;
}

function publicStatus(
  record: SandboxCheckRecord,
  status: SandboxApprovalStatus["status"],
  message: string,
): SandboxApprovalStatus {
  return {
    status,
    providerOrderId: record.providerOrderId,
    orderPlaced: false,
    providerStatus: record.providerStatus,
    milestones: {
      sessionCreated: true,
      cardAndPasskeyApproved: ["closing", "verified"].includes(record.status),
      credentialIssued: ["closing", "verified"].includes(record.status),
      merchantCheckout: "not_attempted",
      providerClosed: record.status === "verified",
    },
    message,
  };
}

async function markVerified(
  record: SandboxCheckRecord,
  providerStatus: "completed" | "failed",
): Promise<SandboxCheckRecord> {
  const verified: SandboxCheckRecord = {
    ...record,
    status: "verified",
    providerStatus,
    verifiedAt: new Date().toISOString(),
  };
  await save(verified);
  await writeAuditEvent({
    userId: verified.userId,
    entityType: "sandbox_approval_check",
    entityId: verified.id,
    eventType: "PRAVA_SANDBOX_APPROVAL_VERIFIED",
    actorType: "api",
    payload: {
      scanId: verified.scanId,
      providerOrderId: verified.providerOrderId,
      providerStatus,
      orderPlaced: false,
      checkoutAttempted: false,
    },
  });
  return verified;
}

export async function createSandboxApprovalCheck(input: {
  userId: string;
  userEmail: string;
  scanId: string;
  productId: string;
  offerId: string;
}) {
  assertSandboxConfigured();
  const scan = await getScanForUser(input.scanId, input.userId);
  if (
    scan.status !== "OFFERS_READY" ||
    scan.selectedProductId !== input.productId
  ) {
    throw new MorrowError({
      code: "FORBIDDEN",
      message: "Sandbox approval requires the scan's verified product",
      statusCode: 409,
    });
  }

  const offers = await listOffersForUser(
    input.scanId,
    input.productId,
    input.userId,
  );
  const offer = offers.find((item) => item.id === input.offerId);
  if (
    !offer ||
    offer.illustrative ||
    offer.identityVerification.status !== "verified" ||
    offer.rejectedReasons.length > 0
  ) {
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Verified sandbox offer not found",
      statusCode: 404,
    });
  }
  if (new Date(offer.expiresAt) <= new Date()) {
    throw new MorrowError({
      code: "OFFER_EXPIRED",
      message: "The selected offer has expired",
      statusCode: 409,
    });
  }

  const checkId = randomUUID();
  const totalAmount = minorUnitsToDecimal(offer.price.estimatedTotalMinor);
  const unitPrice = minorUnitsToDecimal(offer.price.subtotalMinor);
  const description = `Sandbox approval only — ${offer.product.title}`;
  const providerSession = await createPravaSession({
    userId: input.userId,
    userEmail: input.userEmail,
    totalAmount,
    currency: offer.price.currency,
    externalOrderReference: `sandbox-check-${checkId}`,
    merchant: {
      name: offer.merchant.name,
      url: offer.merchant.url,
      countryCode: offer.merchant.countryCode,
      category: "Retail",
    },
    product: {
      id: offer.product.externalVariantId.slice(0, 50),
      description,
      unitPrice,
      quantity: 1,
    },
  });
  const record: SandboxCheckRecord = {
    id: checkId,
    userId: input.userId,
    scanId: input.scanId,
    productId: input.productId,
    offerId: input.offerId,
    providerSessionId: providerSession.session_id,
    providerOrderId: providerSession.order_id,
    expiresAt: providerSession.expires_at,
    createdAt: new Date().toISOString(),
    status: "pending",
    providerStatus: "pending",
    verifiedAt: null,
  };
  await save(record);
  await writeAuditEvent({
    userId: input.userId,
    entityType: "sandbox_approval_check",
    entityId: checkId,
    eventType: "PRAVA_SANDBOX_APPROVAL_STARTED",
    actorType: "user",
    actorId: input.userId,
    payload: {
      scanId: input.scanId,
      offerId: input.offerId,
      providerOrderId: providerSession.order_id,
      amount: totalAmount,
      currency: offer.price.currency,
      orderPlaced: false,
    },
  });
  return {
    sandboxCheckId: checkId,
    providerOrderId: providerSession.order_id,
    sessionToken: providerSession.session_token,
    iframeUrl: providerSession.iframe_url,
    expiresAt: providerSession.expires_at,
  };
}

export async function recordSandboxApprovalClientEvent(
  id: string,
  userId: string,
  event: SandboxApprovalClientEvent,
): Promise<void> {
  const record = await load(id, userId);
  await writeAuditEvent({
    userId,
    entityType: "sandbox_approval_check",
    entityId: record.id,
    eventType:
      event.event === "SDK_DISMISSED"
        ? "PRAVA_SANDBOX_APPROVAL_DISMISSED"
        : event.event === "SESSION_REFRESH_FAILED"
          ? "PRAVA_SANDBOX_SESSION_REFRESH_FAILED"
          : "PRAVA_SANDBOX_CLIENT_ERROR",
    actorType: "user",
    actorId: userId,
    payload: {
      code: event.code,
      message: sanitizeClientEventMessage(event.message),
      responseId: event.responseId,
      occurredAt: event.occurredAt,
      timezone: event.timezone,
      origin: event.origin,
      capabilities: event.capabilities,
      providerOrderId: record.providerOrderId,
      providerStatus: record.providerStatus,
    },
  });
}

export async function getSandboxApprovalStatus(
  id: string,
  userId: string,
): Promise<SandboxApprovalStatus> {
  assertSandboxConfigured();
  let record = await load(id, userId);
  if (record.status === "verified") {
    return publicStatus(
      record,
      "verified",
      "Prava sandbox approval was verified. No merchant order was placed.",
    );
  }
  if (record.status === "failed") {
    return publicStatus(
      record,
      "failed",
      "The Prava sandbox approval did not complete.",
    );
  }
  if (new Date(record.expiresAt) <= new Date()) {
    record = { ...record, status: "failed", providerStatus: "failed" };
    await save(record);
    return publicStatus(record, "expired", "The sandbox session expired.");
  }

  const result = await getPravaPaymentResult(record.providerSessionId);
  if (result.status === "pending") {
    if (record.providerStatus !== "pending") {
      record = { ...record, providerStatus: "pending" };
      await save(record);
    }
    return publicStatus(
      record,
      "pending",
      "Waiting for Prava sandbox approval.",
    );
  }
  if (result.status === "awaiting_result") {
    const credential = extractCheckoutCredential(result);
    if (!credential) {
      return publicStatus(
        record,
        "pending",
        "Prava is preparing the sandbox authorization result.",
      );
    }
    if (record.status === "closing") {
      return publicStatus(
        { ...record, providerStatus: "awaiting_result" },
        "pending",
        "Prava approval is verified. Closing this no-checkout sandbox exercise safely.",
      );
    }
    const lock = await getRedisConnection().set(
      `${SANDBOX_CLOSE_LOCK_PREFIX}${record.id}`,
      record.id,
      "EX",
      30,
      "NX",
    );
    if (lock !== "OK") {
      return publicStatus(
        { ...record, providerStatus: "awaiting_result" },
        "pending",
        "Prava approval is verified. Closing this no-checkout sandbox exercise safely.",
      );
    }
    record = {
      ...record,
      status: "closing",
      providerStatus: "awaiting_result",
    };
    await save(record);
    await reportPravaStatus({
      sessionId: record.providerSessionId,
      transactionReferenceId: credential.transactionReferenceId,
      approved: false,
    });
    const finalResult = await getPravaPaymentResult(record.providerSessionId);
    if (finalResult.status === "failed" || finalResult.status === "completed") {
      record = await markVerified(record, finalResult.status);
      return publicStatus(
        record,
        "verified",
        "Prava sandbox approval was verified. No merchant order was placed.",
      );
    }
    record = { ...record, providerStatus: finalResult.status };
    await save(record);
    return publicStatus(
      record,
      "pending",
      "Prava approval is verified. Waiting for the provider to close this no-checkout exercise.",
    );
  }

  if (
    record.status === "closing" &&
    (result.status === "failed" || result.status === "completed")
  ) {
    record = await markVerified(record, result.status);
    return publicStatus(
      record,
      "verified",
      "Prava sandbox approval was verified. No merchant order was placed.",
    );
  }

  record = { ...record, status: "failed", providerStatus: result.status };
  await save(record);
  return publicStatus(
    record,
    "failed",
    "The Prava sandbox approval did not complete.",
  );
}
