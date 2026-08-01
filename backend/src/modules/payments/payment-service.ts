import {
  decryptTransientSecret,
  encryptTransientSecret,
  type EncryptedEnvelope,
} from "../../common/encryption";
import { MorrowError } from "../../common/errors";
import { minorUnitsToDecimal } from "../../common/money";
import { getEnvironment } from "../../config/env";
import { writeAuditEvent } from "../../infrastructure/database/audit-repository";
import { enqueueCheckout } from "../../infrastructure/queue/queues";
import {
  createPravaSession,
  getPravaPaymentResult,
  PravaApiError,
  publicPaymentResult,
} from "../../integrations/prava/client";
import {
  finalizePaymentSession,
  getPaymentSessionByIntent,
  getPaymentSessionForUser,
  getPurchaseIntent,
  markIdempotencyFailed,
  markIdempotencyUnknown,
  reserveIdempotencyKey,
  updatePaymentSessionStatus,
} from "./payment-repository";
import { reconcilePublicPaymentState } from "./payment-status-policy";

function embeddedSessionResponse(session: {
  id: string;
  providerSessionId: string;
  expiresAt: string | null;
  providerMetadata: Record<string, unknown>;
}) {
  const encrypted = session.providerMetadata.encryptedSessionToken as
    EncryptedEnvelope | undefined;
  const iframeUrl = session.providerMetadata.iframeUrl;
  if (!encrypted || typeof iframeUrl !== "string") {
    throw new MorrowError({
      code: "PAYMENT_SESSION_EXPIRED",
      message: "This payment session can no longer be mounted",
      statusCode: 409,
    });
  }
  return {
    paymentSessionId: session.id,
    providerSessionId: session.providerSessionId,
    sessionToken: decryptTransientSecret(encrypted),
    iframeUrl,
    expiresAt: session.expiresAt,
  };
}

export async function startPaymentSession(input: {
  intentId: string;
  userId: string;
  userEmail: string;
}) {
  const intent = await getPurchaseIntent(input.intentId, input.userId);
  if (intent.status !== "APPROVED") {
    const existing = await getPaymentSessionByIntent(
      input.intentId,
      input.userId,
    );
    if (
      existing &&
      existing.status === "PENDING" &&
      (!existing.expiresAt || new Date(existing.expiresAt) > new Date())
    ) {
      return embeddedSessionResponse(existing);
    }
    throw new MorrowError({
      code: "FORBIDDEN",
      message: "The purchase must be explicitly approved before payment",
      statusCode: 409,
    });
  }
  if (new Date(intent.expiresAt) <= new Date()) {
    throw new MorrowError({
      code: "OFFER_EXPIRED",
      message: "The purchase approval has expired",
      statusCode: 409,
    });
  }

  const idempotencyKey = `prava-session:${intent.id}`;
  const reservation = await reserveIdempotencyKey({
    key: idempotencyKey,
    operation: "create_prava_session",
    ownerId: input.userId,
    request: { intentId: intent.id, version: intent.expiresAt },
  });
  if (reservation === "completed") {
    const existing = await getPaymentSessionByIntent(
      input.intentId,
      input.userId,
    );
    if (existing) return embeddedSessionResponse(existing);
  }
  if (reservation === "in_progress" || reservation === "unknown") {
    throw new MorrowError({
      code: "CHECKOUT_RESULT_UNKNOWN",
      message:
        "Payment-session creation is already in progress or requires reconciliation",
      statusCode: 409,
    });
  }

  const offer = intent.offerSnapshot;
  const productName = [
    intent.productSnapshot.brand,
    intent.productSnapshot.name,
    intent.productSnapshot.variant,
  ]
    .filter(Boolean)
    .join(" ");
  try {
    const callbackUrl = `${getEnvironment().PUBLIC_APP_URL}/scan?purchaseIntentId=${intent.id}`;
    const providerSession = await createPravaSession({
      userId: input.userId,
      userEmail: input.userEmail,
      totalAmount: minorUnitsToDecimal(intent.maxAuthorizedAmountMinor),
      currency: intent.currency,
      ...(callbackUrl.startsWith("https://") ? { callbackUrl } : {}),
      externalOrderReference: intent.id,
      merchant: {
        name: offer.merchant.name,
        url: offer.merchant.url,
        countryCode: offer.merchant.countryCode,
        category: "Retail",
      },
      product: {
        id: offer.product.externalVariantId,
        description: productName || offer.product.title,
        unitPrice: minorUnitsToDecimal(offer.price.subtotalMinor),
        quantity: intent.quantity,
      },
    });
    const session = await finalizePaymentSession({
      idempotencyKey,
      intentId: intent.id,
      providerSessionId: providerSession.session_id,
      providerOrderId: providerSession.order_id,
      expiresAt: new Date(providerSession.expires_at),
      iframeUrl: providerSession.iframe_url,
      encryptedSessionToken: encryptTransientSecret(
        providerSession.session_token,
      ),
    });
    await writeAuditEvent({
      userId: input.userId,
      entityType: "payment_session",
      entityId: session.id,
      eventType: "PRAVA_SESSION_CREATED",
      actorType: "api",
      payload: { purchaseIntentId: intent.id, expiresAt: session.expiresAt },
    });
    return embeddedSessionResponse(session);
  } catch (error) {
    if (
      error instanceof PravaApiError &&
      error.upstreamStatus < 500 &&
      error.upstreamStatus !== 429
    ) {
      await markIdempotencyFailed(idempotencyKey);
    } else {
      await markIdempotencyUnknown(idempotencyKey);
    }
    throw error;
  }
}

export async function syncPaymentStatus(
  paymentSessionId: string,
  userId: string,
) {
  const session = await getPaymentSessionForUser(paymentSessionId, userId);
  const result = await getPravaPaymentResult(session.providerSessionId);
  if (result.status === "awaiting_result") {
    await updatePaymentSessionStatus(session.id, "AWAITING_RESULT", false);
    await enqueueCheckout(session.id);
  } else if (result.status === "failed") {
    await updatePaymentSessionStatus(session.id, "FAILED", true);
  }
  const current = await getPaymentSessionForUser(paymentSessionId, userId);
  const providerResult = publicPaymentResult(result);
  return {
    ...providerResult,
    providerStatus: providerResult.status,
    status: reconcilePublicPaymentState(result.status, current.status),
    checkoutStatus: current.status,
    checkoutIssue: current.providerMetadata["checkoutIssue"] ?? null,
  };
}
