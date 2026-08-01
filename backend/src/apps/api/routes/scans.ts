import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MorrowError } from "../../../common/errors";
import { getEnvironment } from "../../../config/env";
import {
  createScan,
  addScanImages,
  getEvidence,
  getScanForUser,
  getUploadsForUser,
  listScansForUser,
  markUploadStored,
} from "../../../infrastructure/database/scan-repository";
import { enqueueScan } from "../../../infrastructure/queue/queues";
import { assertStoredObject } from "../../../infrastructure/storage/r2";
import { listCandidatesForUser } from "../../../modules/catalog/catalog-repository";

const idParamsSchema = z.object({ scanId: z.uuid() });
const createBodySchema = z.object({
  images: z
    .array(
      z.object({
        uploadId: z.uuid(),
        role: z.enum(["primary", "label", "barcode"]),
      }),
    )
    .min(1)
    .max(5),
  intent: z.object({
    mode: z.enum(["exact", "similar_allowed"]).default("exact"),
    quantity: z.number().int().positive().max(20).default(1),
    maxBudget: z
      .object({
        amountMinor: z.number().int().nonnegative(),
        currency: z.string().length(3),
      })
      .optional(),
    countryCode: z.string().length(2).default("IN"),
  }),
});

export const scanRoutes: FastifyPluginAsync = async (app) => {
  app.get("/scans", async (request) => ({
    scans: await listScansForUser(request.principal.userId),
  }));

  app.post("/scans", async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "Invalid scan request",
        details: { issues: parsed.error.issues },
      });
    }
    const uploadIds = parsed.data.images.map((image) => image.uploadId);
    const uploads = await getUploadsForUser(
      uploadIds,
      request.principal.userId,
    );
    if (uploads.length !== uploadIds.length) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "One or more uploads are missing or expired",
      });
    }
    await Promise.all(
      uploads.map(async (upload) => {
        const stored = await assertStoredObject(upload.objectKey);
        if (
          stored.sizeBytes <= 0 ||
          stored.sizeBytes > getEnvironment().MAX_UPLOAD_BYTES
        ) {
          throw new MorrowError({
            code: "IMAGE_TOO_LARGE",
            message: "Image is empty or exceeds the upload limit",
          });
        }
        await markUploadStored(upload.id, stored.sizeBytes);
      }),
    );
    const scan = await createScan({
      userId: request.principal.userId,
      images: parsed.data.images,
      mode: parsed.data.intent.mode,
      quantity: parsed.data.intent.quantity,
      countryCode: parsed.data.intent.countryCode.toUpperCase(),
      ...(parsed.data.intent.maxBudget
        ? {
            maxBudgetMinor: parsed.data.intent.maxBudget.amountMinor,
            currency: parsed.data.intent.maxBudget.currency.toUpperCase(),
          }
        : {}),
    });
    await enqueueScan(scan.id, scan.version);
    return reply.code(202).send({ scanId: scan.id, status: scan.status });
  });

  app.get("/scans/:scanId", async (request) => {
    const params = idParamsSchema.parse(request.params);
    const scan = await getScanForUser(params.scanId, request.principal.userId);
    const evidence = await getEvidence(scan.id);
    return { ...scan, evidence };
  });

  app.post("/scans/:scanId/images", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const body = z
      .object({
        images: z
          .array(
            z.object({
              uploadId: z.uuid(),
              role: z.enum(["primary", "label", "barcode"]),
            }),
          )
          .min(1)
          .max(4),
      })
      .parse(request.body);
    const uploadIds = body.images.map((image) => image.uploadId);
    const uploads = await getUploadsForUser(
      uploadIds,
      request.principal.userId,
    );
    if (uploads.length !== uploadIds.length) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "One or more evidence uploads are missing",
      });
    }
    await Promise.all(
      uploads.map(async (upload) => {
        const stored = await assertStoredObject(upload.objectKey);
        if (
          stored.sizeBytes <= 0 ||
          stored.sizeBytes > getEnvironment().MAX_UPLOAD_BYTES
        ) {
          throw new MorrowError({
            code: "IMAGE_TOO_LARGE",
            message: "Image is empty or exceeds the upload limit",
          });
        }
        await markUploadStored(upload.id, stored.sizeBytes);
      }),
    );
    const scan = await addScanImages({
      scanId: params.scanId,
      userId: request.principal.userId,
      images: body.images,
    });
    await enqueueScan(scan.id, scan.version);
    return reply.code(202).send({ scanId: scan.id, status: scan.status });
  });

  app.get("/scans/:scanId/candidates", async (request) => {
    const params = idParamsSchema.parse(request.params);
    await getScanForUser(params.scanId, request.principal.userId);
    return {
      candidates: await listCandidatesForUser(
        params.scanId,
        request.principal.userId,
      ),
    };
  });

  app.post("/scans/:scanId/retry", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const scan = await getScanForUser(params.scanId, request.principal.userId);
    if (
      ![
        "PREPROCESSING",
        "EVIDENCE_EXTRACTED",
        "CANDIDATES_RETRIEVED",
        "VERIFYING",
        "SEARCHING_MERCHANTS",
      ].includes(scan.status)
    ) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "This scan is not in a retryable state",
        statusCode: 409,
      });
    }
    await enqueueScan(scan.id, `retry-${Date.now()}`);
    return reply.code(202).send({ scanId: scan.id, status: scan.status });
  });

  app.get("/scans/:scanId/events", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    await getScanForUser(params.scanId, request.principal.userId);
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    let open = true;
    let version = -1;
    request.raw.once("close", () => {
      open = false;
    });
    while (open) {
      const scan = await getScanForUser(
        params.scanId,
        request.principal.userId,
      );
      if (scan.version !== version) {
        reply.raw.write(`event: scan\ndata: ${JSON.stringify(scan)}\n\n`);
        version = scan.version;
      } else {
        reply.raw.write(": keep-alive\n\n");
      }
      if (
        [
          "REQUIRES_MORE_EVIDENCE",
          "SIMILAR_FOUND",
          "AMBIGUOUS",
          "OFFERS_READY",
          "ORDER_COMPLETED",
          "CHECKOUT_FAILED",
        ].includes(scan.status) ||
        (scan.errorCode !== null && scan.status !== "OFFERS_READY")
      ) {
        reply.raw.end();
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  });
};
