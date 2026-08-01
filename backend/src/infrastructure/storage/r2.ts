import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { getEnvironment } from "../../config/env";

let client: S3Client | undefined;

function getClient(): S3Client {
  if (!client) {
    const env = getEnvironment();
    if (
      !env.R2_ACCOUNT_ID ||
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY
    ) {
      throw new Error("R2 credentials are required");
    }
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

function bucket(): string {
  const name = getEnvironment().R2_BUCKET_NAME;
  if (!name) throw new Error("R2_BUCKET_NAME is required");
  return name;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export function createUploadObjectKey(
  userId: string,
  mimeType: string,
): string {
  const extension = MIME_EXTENSIONS[mimeType] ?? "bin";
  return `scans/${safeSegment(userId)}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
}

export async function createPresignedUpload(input: {
  objectKey: string;
  mimeType: string;
}): Promise<string> {
  const env = getEnvironment();
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: input.objectKey,
      ContentType: input.mimeType,
      Metadata: { retention: "source-24h" },
    }),
    { expiresIn: env.UPLOAD_URL_TTL_SECONDS },
  );
}

export async function assertStoredObject(
  objectKey: string,
): Promise<{ sizeBytes: number }> {
  const response = await getClient().send(
    new HeadObjectCommand({ Bucket: bucket(), Key: objectKey }),
  );
  return { sizeBytes: response.ContentLength ?? 0 };
}

export async function readObject(objectKey: string): Promise<Buffer> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: bucket(), Key: objectKey }),
  );
  if (!response.Body) throw new Error(`R2 object has no body: ${objectKey}`);
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function writeObject(input: {
  objectKey: string;
  body: Buffer;
  contentType: string;
  retention: "processed-7d" | "thumbnail-7d" | "confirmed-with-consent";
}): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: input.objectKey,
      Body: input.body,
      ContentType: input.contentType,
      Metadata: { retention: input.retention },
    }),
  );
}

export async function deleteObject(objectKey: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey }),
  );
}
