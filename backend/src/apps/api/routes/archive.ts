import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { getScanForUser } from "../../../infrastructure/database/scan-repository";
import { enqueueScan } from "../../../infrastructure/queue/queues";
import {
  createArchiveRepeat,
  listArchiveDossiers,
} from "../../../modules/archive/archive-repository";
import { assertAiBudgetCanStart } from "../../../modules/usage/ai-usage-repository";

const paramsSchema = z.object({ scanId: z.uuid() });
const repeatSchema = z.object({
  action: z.enum(["reorder", "prepare_approval"]),
  quantity: z.number().int().positive().max(20).default(1),
  maxBudgetMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

export const archiveRoutes: FastifyPluginAsync = async (app) => {
  app.get("/archive", async (request) => ({
    dossiers: await listArchiveDossiers(request.principal.userId),
  }));

  app.post(
    "/archive/:scanId/repeat",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const params = paramsSchema.parse(request.params);
      const body = repeatSchema.parse(request.body);
      await getScanForUser(params.scanId, request.principal.userId);
      await assertAiBudgetCanStart(request.principal.userId);
      const repeat = await createArchiveRepeat({
        sourceScanId: params.scanId,
        userId: request.principal.userId,
        action: body.action,
        quantity: body.quantity,
        ...(body.maxBudgetMinor === undefined
          ? {}
          : { maxBudgetMinor: body.maxBudgetMinor }),
        ...(body.currency === undefined
          ? {}
          : { currency: body.currency.toUpperCase() }),
      });
      await enqueueScan(repeat.scanId, `archive-repeat-${repeat.version}`);
      return reply.code(202).send({
        scanId: repeat.scanId,
        status: repeat.status,
      });
    },
  );
};
