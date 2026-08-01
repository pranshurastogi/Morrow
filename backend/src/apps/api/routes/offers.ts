import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MorrowError } from "../../../common/errors";
import { getScanForUser } from "../../../infrastructure/database/scan-repository";
import { getCheckoutCapability } from "../../../infrastructure/runtime/checkout-capability";
import { writeAuditEvent } from "../../../infrastructure/database/audit-repository";
import { discoverUcpCatalog } from "../../../integrations/shopify-ucp/discovery";
import { ingestUcpCatalog } from "../../../integrations/shopify-ucp/catalog-ingestion";
import {
  listOffersForUser,
  searchVerifiedListings,
} from "../../../modules/offers/offer-repository";

const productParamsSchema = z.object({ productId: z.uuid() });
const searchBodySchema = z.object({
  scanId: z.uuid(),
  requirements: z.object({
    maxTotalMinor: z.number().int().nonnegative().optional(),
    currency: z.string().length(3),
    deliveryBefore: z.iso.datetime().optional(),
  }),
});
const listQuerySchema = z.object({ scanId: z.uuid() });

export const offerRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/products/:productId/offers/search",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (request) => {
      const params = productParamsSchema.parse(request.params);
      const body = searchBodySchema.parse(request.body);
      const scan = await getScanForUser(body.scanId, request.principal.userId);
      if (
        scan.selectedProductId !== params.productId ||
        scan.status !== "OFFERS_READY"
      ) {
        throw new MorrowError({
          code: "FORBIDDEN",
          message:
            "Offers can only be refreshed for the scan's verified product",
          statusCode: 409,
        });
      }
      if (!scan.observation) {
        throw new MorrowError({
          code: "INVALID_REQUEST",
          message:
            "The product observation is unavailable for merchant refresh",
          statusCode: 409,
        });
      }
      const discovery = await discoverUcpCatalog({
        observation: scan.observation,
        countryCode: scan.countryCode ?? "IN",
        currency: body.requirements.currency,
      });
      const refreshedProductIds = await ingestUcpCatalog({
        results: discovery.results,
        observation: scan.observation,
      });
      const offers = await searchVerifiedListings({
        scanId: scan.id,
        productId: params.productId,
        requirements: {
          currency: body.requirements.currency,
          ...(body.requirements.maxTotalMinor === undefined
            ? {}
            : { maxTotalMinor: body.requirements.maxTotalMinor }),
          ...(body.requirements.deliveryBefore === undefined
            ? {}
            : { deliveryBefore: body.requirements.deliveryBefore }),
        },
      });
      await writeAuditEvent({
        userId: request.principal.userId,
        entityType: "scan",
        entityId: scan.id,
        eventType: "MERCHANT_OFFERS_REFRESHED",
        actorType: "user",
        payload: {
          productCount: discovery.productCount,
          ingestedProductCount: refreshedProductIds.length,
          listingCount: offers.length,
          failedAttempts: discovery.attempts.filter(
            (attempt) => attempt.status === "failed",
          ).length,
        },
      });
      return {
        offers,
        checkout: await getCheckoutCapability(),
        discovery: {
          productCount: discovery.productCount,
          merchantCount: new Set(
            discovery.attempts.map((attempt) => attempt.merchant),
          ).size,
          failedMerchantCount: discovery.attempts.filter(
            (attempt) => attempt.status === "failed",
          ).length,
        },
      };
    },
  );

  app.get("/products/:productId/offers", async (request) => {
    const params = productParamsSchema.parse(request.params);
    const query = listQuerySchema.parse(request.query);
    const [offers, checkout] = await Promise.all([
      listOffersForUser(
        query.scanId,
        params.productId,
        request.principal.userId,
      ),
      getCheckoutCapability(),
    ]);
    return { offers, checkout };
  });
};
