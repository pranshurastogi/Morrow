import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MorrowError } from "../../../common/errors";
import { writeAuditEvent } from "../../../infrastructure/database/audit-repository";
import {
  approvePurchaseIntent,
  createPurchaseIntent,
  getPurchaseIntent,
} from "../../../modules/payments/payment-repository";
import {
  startPaymentSession,
  syncPaymentStatus,
} from "../../../modules/payments/payment-service";

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

export const paymentRoutes: FastifyPluginAsync = async (app) => {
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
};
