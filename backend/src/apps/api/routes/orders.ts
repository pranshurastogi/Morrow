import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getOrder, listOrders } from "../../../modules/orders/order-repository";

const paramsSchema = z.object({ orderId: z.uuid() });

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get("/orders", async (request) => ({
    orders: await listOrders(request.principal.userId),
  }));
  app.get("/orders/:orderId", async (request) => {
    const params = paramsSchema.parse(request.params);
    return getOrder(params.orderId, request.principal.userId);
  });
};
