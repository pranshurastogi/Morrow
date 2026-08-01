import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MorrowError } from "../../../common/errors";
import { getScanForUser } from "../../../infrastructure/database/scan-repository";
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
  app.post("/products/:productId/offers/search", async (request) => {
    const params = productParamsSchema.parse(request.params);
    const body = searchBodySchema.parse(request.body);
    const scan = await getScanForUser(body.scanId, request.principal.userId);
    if (
      scan.selectedProductId !== params.productId ||
      scan.status !== "OFFERS_READY"
    ) {
      throw new MorrowError({
        code: "FORBIDDEN",
        message: "Offers can only be refreshed for the scan's verified product",
        statusCode: 409,
      });
    }
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
    return { offers };
  });

  app.get("/products/:productId/offers", async (request) => {
    const params = productParamsSchema.parse(request.params);
    const query = listQuerySchema.parse(request.query);
    return {
      offers: await listOffersForUser(
        query.scanId,
        params.productId,
        request.principal.userId,
      ),
    };
  });
};
