import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MorrowError } from "../../../common/errors";
import { writeAuditEvent } from "../../../infrastructure/database/audit-repository";
import { assertCheckoutExecutionAvailable } from "../../../infrastructure/runtime/checkout-capability";
import {
  approvePurchaseIntent,
  createPurchaseIntent,
  getPurchaseIntent,
  listPurchaseIntents,
} from "../../../modules/payments/payment-repository";
import {
  startPaymentSession,
  syncPaymentStatus,
} from "../../../modules/payments/payment-service";
import {
  createSandboxApprovalCheck,
  getSandboxApprovalStatus,
  recordSandboxApprovalClientEvent,
} from "../../../modules/payments/sandbox-approval-service";

const intentParamsSchema = z.object({ id: z.uuid() });
const paymentParamsSchema = z.object({ id: z.uuid() });
const createIntentSchema = z.object({
  scanId: z.uuid(),
  productId: z.uuid(),
  offerId: z.uuid(),
  quantity: z.number().int().positive().max(20),
  maximumAuthorizedTotalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  shippingAddressId: z.string().min(1).max(255).optional(),
});
const sandboxApprovalParamsSchema = z.object({ id: z.uuid() });
const sandboxApprovalBodySchema = z.object({
  scanId: z.uuid(),
  productId: z.uuid(),
  offerId: z.uuid(),
});
const sandboxClientEventSchema = z.object({
  event: z.enum(["SDK_ERROR", "SDK_DISMISSED", "SESSION_REFRESH_FAILED"]),
  code: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_.:-]+$/),
  message: z.string().min(1).max(400),
  responseId: z.string().min(1).max(255).nullable(),
  occurredAt: z.iso.datetime(),
  timezone: z.string().min(1).max(100),
  origin: z.url().max(500),
  capabilities: z.object({
    secureContext: z.boolean(),
    webAuthnAvailable: z.boolean(),
    platformAuthenticatorAvailable: z.boolean().nullable(),
  }),
});

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.get("/purchase-intents", async (request) => ({
    purchaseIntents: await listPurchaseIntents(request.principal.userId),
  }));

  app.post("/purchase-intents", async (request, reply) => {
    const body = createIntentSchema.parse(request.body);
    const intent = await createPurchaseIntent({
      userId: request.principal.userId,
      scanId: body.scanId,
      productId: body.productId,
      offerId: body.offerId,
      quantity: body.quantity,
      maximumAuthorizedTotalMinor: body.maximumAuthorizedTotalMinor,
      currency: body.currency,
      ...(body.shippingAddressId
        ? { shippingAddressId: body.shippingAddressId }
        : {}),
    });
    return reply.code(201).send(intent);
  });

  app.get("/purchase-intents/:id", async (request) => {
    const params = intentParamsSchema.parse(request.params);
    return getPurchaseIntent(params.id, request.principal.userId);
  });

  app.post("/purchase-intents/:id/approve", async (request) => {
    const params = intentParamsSchema.parse(request.params);
    await assertCheckoutExecutionAvailable();
    const intent = await approvePurchaseIntent(
      params.id,
      request.principal.userId,
    );
    await writeAuditEvent({
      userId: request.principal.userId,
      entityType: "purchase_intent",
      entityId: intent.id,
      eventType: "USER_APPROVED_PURCHASE",
      actorType: "user",
      actorId: request.principal.userId,
      payload: {
        productId: intent.canonicalProductId,
        offerId: intent.selectedOfferId,
        maximumAuthorizedTotalMinor: intent.maxAuthorizedAmountMinor,
        currency: intent.currency,
        expiresAt: intent.expiresAt,
      },
    });
    return intent;
  });

  app.post(
    "/purchase-intents/:id/payment-session",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = intentParamsSchema.parse(request.params);
      if (!request.principal.email) {
        throw new MorrowError({
          code: "INVALID_REQUEST",
          message: "A verified email is required to create a Prava session",
        });
      }
      const session = await startPaymentSession({
        intentId: params.id,
        userId: request.principal.userId,
        userEmail: request.principal.email,
      });
      reply.header("Cache-Control", "no-store");
      return session;
    },
  );

  app.get(
    "/payments/:id/status",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = paymentParamsSchema.parse(request.params);
      reply.header("Cache-Control", "no-store");
      return syncPaymentStatus(params.id, request.principal.userId);
    },
  );

  app.post(
    "/sandbox-approval-checks",
    { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } },
    async (request, reply) => {
      if (!request.principal.email) {
        throw new MorrowError({
          code: "INVALID_REQUEST",
          message: "A verified email is required for Prava sandbox approval",
        });
      }
      const body = sandboxApprovalBodySchema.parse(request.body);
      const session = await createSandboxApprovalCheck({
        userId: request.principal.userId,
        userEmail: request.principal.email,
        ...body,
      });
      reply.header("Cache-Control", "no-store");
      return session;
    },
  );

  app.get(
    "/sandbox-approval-checks/:id",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = sandboxApprovalParamsSchema.parse(request.params);
      reply.header("Cache-Control", "no-store");
      return getSandboxApprovalStatus(params.id, request.principal.userId);
    },
  );

  app.post(
    "/sandbox-approval-checks/:id/client-events",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = sandboxApprovalParamsSchema.parse(request.params);
      const event = sandboxClientEventSchema.parse(request.body);
      await recordSandboxApprovalClientEvent(
        params.id,
        request.principal.userId,
        event,
      );
      reply.header("Cache-Control", "no-store");
      return reply.code(202).send({ recorded: true as const });
    },
  );
};
