import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MorrowError } from "../../../common/errors";
import { getEnvironment } from "../../../config/env";
import { createUpload } from "../../../infrastructure/database/scan-repository";
import {
  createPresignedUpload,
  createUploadObjectKey,
} from "../../../infrastructure/storage/r2";

const bodySchema = z.object({
  mimeType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
  ]),
  purpose: z.enum(["product_scan", "additional_evidence"]),
});

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post("/uploads/presign", async (request) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "Invalid upload request",
        details: { issues: parsed.error.issues },
      });
    }
    const env = getEnvironment();
    const objectKey = createUploadObjectKey(
      request.principal.userId,
      parsed.data.mimeType,
    );
    const expiresAt = new Date(Date.now() + env.UPLOAD_URL_TTL_SECONDS * 1_000);
    const upload = await createUpload({
      userId: request.principal.userId,
      objectKey,
      mimeType: parsed.data.mimeType,
      purpose: parsed.data.purpose,
      expiresAt,
    });
    const uploadUrl = await createPresignedUpload({
      objectKey,
      mimeType: parsed.data.mimeType,
    });
    return {
      uploadId: upload.id,
      uploadUrl,
      objectKey,
      expiresIn: env.UPLOAD_URL_TTL_SECONDS,
      maxBytes: env.MAX_UPLOAD_BYTES,
    };
  });
};
