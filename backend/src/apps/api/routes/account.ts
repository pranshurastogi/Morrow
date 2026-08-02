import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { writeAuditEvent } from "../../../infrastructure/database/audit-repository";
import {
  deletePravaCard,
  listPravaCards,
} from "../../../integrations/prava/client";
import {
  addressInputSchema,
  createUserAddress,
  deleteUserAddress,
  listUserAddresses,
  setDefaultUserAddress,
  updateUserAddress,
} from "../../../modules/account/address-repository";
import { getAiUsageSummary } from "../../../modules/usage/ai-usage-repository";

const addressParamsSchema = z.object({ id: z.uuid() });
const cardParamsSchema = z.object({ id: z.string().min(1).max(255) });

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/account/ai-usage",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      reply.header("Cache-Control", "private, no-store");
      return getAiUsageSummary(request.principal.userId);
    },
  );

  app.get("/account/addresses", async (request, reply) => {
    reply.header("Cache-Control", "private, no-store");
    return {
      addresses: await listUserAddresses(request.principal.userId),
    };
  });

  app.post("/account/addresses", async (request, reply) => {
    const address = await createUserAddress(
      request.principal.userId,
      addressInputSchema.parse(request.body),
    );
    await writeAuditEvent({
      userId: request.principal.userId,
      entityType: "user_address",
      entityId: address.id,
      eventType: "DELIVERY_ADDRESS_CREATED",
      actorType: "user",
      actorId: request.principal.userId,
      payload: { isDefault: address.isDefault },
    });
    reply.header("Cache-Control", "private, no-store");
    return reply.code(201).send(address);
  });

  app.patch("/account/addresses/:id", async (request, reply) => {
    const params = addressParamsSchema.parse(request.params);
    const address = await updateUserAddress(
      params.id,
      request.principal.userId,
      addressInputSchema.parse(request.body),
    );
    await writeAuditEvent({
      userId: request.principal.userId,
      entityType: "user_address",
      entityId: address.id,
      eventType: "DELIVERY_ADDRESS_UPDATED",
      actorType: "user",
      actorId: request.principal.userId,
      payload: { isDefault: address.isDefault },
    });
    reply.header("Cache-Control", "private, no-store");
    return address;
  });

  app.post("/account/addresses/:id/default", async (request, reply) => {
    const params = addressParamsSchema.parse(request.params);
    const address = await setDefaultUserAddress(
      params.id,
      request.principal.userId,
    );
    await writeAuditEvent({
      userId: request.principal.userId,
      entityType: "user_address",
      entityId: address.id,
      eventType: "DEFAULT_DELIVERY_ADDRESS_CHANGED",
      actorType: "user",
      actorId: request.principal.userId,
    });
    reply.header("Cache-Control", "private, no-store");
    return address;
  });

  app.delete("/account/addresses/:id", async (request, reply) => {
    const params = addressParamsSchema.parse(request.params);
    await deleteUserAddress(params.id, request.principal.userId);
    await writeAuditEvent({
      userId: request.principal.userId,
      entityType: "user_address",
      entityId: params.id,
      eventType: "DELIVERY_ADDRESS_DELETED",
      actorType: "user",
      actorId: request.principal.userId,
    });
    return reply.code(204).send();
  });

  app.get(
    "/account/cards",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const cards = await listPravaCards(request.principal.userId);
      reply.header("Cache-Control", "private, no-store");
      return {
        cards: cards.map((card) => ({
          id: card.card_id,
          last4: card.card_last4,
          brand: card.card_brand,
          expMonth: card.card_exp_month,
          expYear: card.card_exp_year,
          isDefault: card.is_default,
          status: card.status,
          createdAt: card.created_at,
        })),
      };
    },
  );

  app.delete(
    "/account/cards/:id",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = cardParamsSchema.parse(request.params);
      const result = await deletePravaCard({
        customerId: request.principal.userId,
        cardId: params.id,
      });
      await writeAuditEvent({
        userId: request.principal.userId,
        entityType: "prava_card",
        entityId: randomUUID(),
        eventType: "PRAVA_CARD_RETIRED",
        actorType: "user",
        actorId: request.principal.userId,
        payload: {
          wasDefault: result.was_default,
          networkTokenDeleted: result.network_token_deleted,
        },
      });
      reply.header("Cache-Control", "private, no-store");
      return {
        success: result.success,
        wasDefault: result.was_default,
        networkTokenDeleted: result.network_token_deleted,
      };
    },
  );
};
