import type { Sql } from "postgres";
import { MorrowError } from "../../common/errors";
import type {
  CaptureInstruction,
  ProductObservation,
} from "../../domain/product-observation";
import {
  assertScanTransition,
  type ScanStatus,
} from "../../domain/scan-status";
import { getDatabase } from "./client";
import { databaseJson } from "./json";

export interface ScanRecord {
  id: string;
  userId: string;
  status: ScanStatus;
  mode: "exact" | "similar_allowed";
  quantity: number;
  maxBudgetMinor: number | null;
  currency: string | null;
  countryCode: string | null;
  observation: ProductObservation | null;
  nextCapture: CaptureInstruction | null;
  selectedProductId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScanImageRecord {
  id: string;
  uploadId: string;
  role: "primary" | "label" | "barcode" | "object_crop" | "thumbnail";
  objectKey: string;
  processedObjectKey: string | null;
  thumbnailObjectKey: string | null;
  sha256: string | null;
}

function mapScan(row: Record<string, unknown>): ScanRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    status: row.status as ScanStatus,
    mode: row.mode as ScanRecord["mode"],
    quantity: Number(row.quantity),
    maxBudgetMinor:
      row.max_budget_minor === null ? null : Number(row.max_budget_minor),
    currency: row.currency === null ? null : String(row.currency).trim(),
    countryCode:
      row.country_code === null ? null : String(row.country_code).trim(),
    observation: (row.observation as ProductObservation | null) ?? null,
    nextCapture: (row.next_capture as CaptureInstruction | null) ?? null,
    selectedProductId:
      row.selected_product_id === null ? null : String(row.selected_product_id),
    errorCode: row.error_code === null ? null : String(row.error_code),
    errorMessage: row.error_message === null ? null : String(row.error_message),
    version: Number(row.version),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function createUpload(
  input: {
    userId: string;
    objectKey: string;
    mimeType: string;
    purpose: "product_scan" | "additional_evidence";
    expiresAt: Date;
  },
  sql: Sql = getDatabase(),
): Promise<{ id: string }> {
  const [row] = await sql`
    insert into uploads (user_id, object_key, mime_type, purpose, expires_at)
    values (${input.userId}, ${input.objectKey}, ${input.mimeType}, ${input.purpose}, ${input.expiresAt})
    returning id
  `;
  if (!row) throw new Error("Upload record was not created");
  return { id: String(row.id) };
}

export async function createScan(
  input: {
    userId: string;
    images: Array<{ uploadId: string; role: "primary" | "label" | "barcode" }>;
    mode: "exact" | "similar_allowed";
    quantity: number;
    maxBudgetMinor?: number;
    currency?: string;
    countryCode?: string;
  },
  sql: Sql = getDatabase(),
): Promise<ScanRecord> {
  return sql.begin(async (transaction) => {
    const uploadIds = input.images.map((image) => image.uploadId);
    const uploads = await transaction`
      select id, object_key from uploads
      where id in ${transaction(uploadIds)} and user_id = ${input.userId}
        and status in ('PRESIGNED', 'STORED') and expires_at > now()
      for update
    `;
    if (uploads.length !== uploadIds.length) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message:
          "One or more uploads are missing, expired, or owned by another user",
      });
    }

    const [scanRow] = await transaction`
      insert into scans (
        user_id, status, mode, quantity, max_budget_minor, currency, country_code
      ) values (
        ${input.userId}, 'IMAGE_UPLOADED', ${input.mode}, ${input.quantity},
        ${input.maxBudgetMinor ?? null}, ${input.currency ?? null}, ${input.countryCode ?? null}
      ) returning *
    `;
    if (!scanRow) throw new Error("Scan was not created");

    const objectKeys = new Map(
      uploads.map((row) => [String(row.id), String(row.object_key)]),
    );
    for (const image of input.images) {
      const objectKey = objectKeys.get(image.uploadId);
      if (!objectKey) throw new Error("Upload object key is missing");
      await transaction`
        insert into scan_images (scan_id, upload_id, role, object_key)
        values (${scanRow.id}, ${image.uploadId}, ${image.role}, ${objectKey})
      `;
    }
    await transaction`
      update uploads set status = 'ATTACHED' where id in ${transaction(uploadIds)}
    `;
    return mapScan(scanRow);
  });
}

export async function getUploadsForUser(
  uploadIds: string[],
  userId: string,
  sql: Sql = getDatabase(),
): Promise<Array<{ id: string; objectKey: string; mimeType: string }>> {
  if (uploadIds.length === 0) return [];
  const rows = await sql`
    select id, object_key, mime_type from uploads
    where id in ${sql(uploadIds)} and user_id = ${userId} and expires_at > now()
      and status in ('PRESIGNED', 'STORED')
  `;
  return rows.map((row) => ({
    id: String(row.id),
    objectKey: String(row.object_key),
    mimeType: String(row.mime_type),
  }));
}

export async function markUploadStored(
  uploadId: string,
  sizeBytes: number,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    update uploads set status = 'STORED', size_bytes = ${sizeBytes}
    where id = ${uploadId} and status in ('PRESIGNED', 'STORED')
  `;
}

export async function addScanImages(
  input: {
    scanId: string;
    userId: string;
    images: Array<{ uploadId: string; role: "primary" | "label" | "barcode" }>;
  },
  sql: Sql = getDatabase(),
): Promise<ScanRecord> {
  return sql.begin(async (transaction) => {
    const [scan] = await transaction`
      select * from scans where id = ${input.scanId} and user_id = ${input.userId} for update
    `;
    if (!scan)
      throw new MorrowError({
        code: "NOT_FOUND",
        message: "Scan not found",
        statusCode: 404,
      });
    if (
      !["REQUIRES_MORE_EVIDENCE", "AMBIGUOUS"].includes(String(scan.status))
    ) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "This scan is not waiting for more evidence",
        statusCode: 409,
      });
    }
    const uploadIds = input.images.map((image) => image.uploadId);
    const uploads = await transaction`
      select id, object_key from uploads where id in ${transaction(uploadIds)}
        and user_id = ${input.userId} and status = 'STORED' and expires_at > now()
      for update
    `;
    if (uploads.length !== uploadIds.length) {
      throw new MorrowError({
        code: "INVALID_REQUEST",
        message: "Additional evidence upload is unavailable",
      });
    }
    const keys = new Map(
      uploads.map((upload) => [String(upload.id), String(upload.object_key)]),
    );
    for (const image of input.images) {
      const objectKey = keys.get(image.uploadId);
      if (!objectKey) throw new Error("Upload object key is missing");
      await transaction`
        insert into scan_images (scan_id, upload_id, role, object_key)
        values (${input.scanId}, ${image.uploadId}, ${image.role}, ${objectKey})
      `;
    }
    await transaction`update uploads set status = 'ATTACHED' where id in ${transaction(uploadIds)}`;
    const [updated] = await transaction`
      update scans set status = 'IMAGE_UPLOADED', next_capture = null, error_code = null,
        error_message = null, version = version + 1 where id = ${input.scanId} returning *
    `;
    if (!updated) throw new Error("Scan was not updated");
    return mapScan(updated);
  });
}

export async function getScanForUser(
  scanId: string,
  userId: string,
  sql: Sql = getDatabase(),
): Promise<ScanRecord> {
  const [row] =
    await sql`select * from scans where id = ${scanId} and user_id = ${userId}`;
  if (!row)
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Scan not found",
      statusCode: 404,
    });
  return mapScan(row);
}

export async function listScansForUser(
  userId: string,
  sql: Sql = getDatabase(),
): Promise<ScanRecord[]> {
  const rows = await sql`
    select * from scans
    where user_id = ${userId}
    order by created_at desc
    limit 100
  `;
  return rows.map(mapScan);
}

export async function getScan(
  scanId: string,
  sql: Sql = getDatabase(),
): Promise<ScanRecord> {
  const [row] = await sql`select * from scans where id = ${scanId}`;
  if (!row)
    throw new MorrowError({
      code: "NOT_FOUND",
      message: "Scan not found",
      statusCode: 404,
    });
  return mapScan(row);
}

export async function getScanImages(
  scanId: string,
  sql: Sql = getDatabase(),
): Promise<ScanImageRecord[]> {
  const rows =
    await sql`select * from scan_images where scan_id = ${scanId} order by created_at`;
  return rows.map((row) => ({
    id: String(row.id),
    uploadId: String(row.upload_id),
    role: row.role as ScanImageRecord["role"],
    objectKey: String(row.object_key),
    processedObjectKey:
      row.processed_object_key === null
        ? null
        : String(row.processed_object_key),
    thumbnailObjectKey:
      row.thumbnail_object_key === null
        ? null
        : String(row.thumbnail_object_key),
    sha256: row.sha256 === null ? null : String(row.sha256),
  }));
}

export async function transitionScan(
  scanId: string,
  to: ScanStatus,
  patch: {
    observation?: ProductObservation;
    nextCapture?: CaptureInstruction | null;
    selectedProductId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  } = {},
  sql: Sql = getDatabase(),
): Promise<ScanRecord> {
  return sql.begin(async (transaction) => {
    const [current] =
      await transaction`select * from scans where id = ${scanId} for update`;
    if (!current)
      throw new MorrowError({
        code: "NOT_FOUND",
        message: "Scan not found",
        statusCode: 404,
      });
    assertScanTransition(current.status as ScanStatus, to);
    const [updated] = await transaction`
      update scans set
        status = ${to},
        observation = coalesce(${patch.observation ? transaction.json(databaseJson(patch.observation)) : null}, observation),
        next_capture = ${patch.nextCapture === undefined ? current.next_capture : transaction.json(databaseJson(patch.nextCapture))},
        selected_product_id = ${patch.selectedProductId === undefined ? current.selected_product_id : patch.selectedProductId},
        error_code = ${patch.errorCode === undefined ? current.error_code : patch.errorCode},
        error_message = ${patch.errorMessage === undefined ? current.error_message : patch.errorMessage},
        version = version + 1
      where id = ${scanId} and version = ${current.version}
      returning *
    `;
    if (!updated)
      throw new MorrowError({
        code: "INTERNAL_ERROR",
        message: "Concurrent scan update",
        statusCode: 409,
      });
    return mapScan(updated);
  });
}

export async function saveImagePreparation(
  imageId: string,
  input: {
    processedObjectKey: string;
    thumbnailObjectKey: string;
    width: number;
    height: number;
    blurScore: number;
    brightnessScore: number;
    sha256: string;
  },
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    update scan_images set
      processed_object_key = ${input.processedObjectKey}, thumbnail_object_key = ${input.thumbnailObjectKey},
      width = ${input.width}, height = ${input.height}, blur_score = ${input.blurScore},
      brightness_score = ${input.brightnessScore}, sha256 = ${input.sha256}
    where id = ${imageId}
  `;
}

export async function addEvidence(
  input: {
    scanId: string;
    evidenceType: string;
    value: unknown;
    normalizedValue?: string;
    source:
      | "barcode_decoder"
      | "ocr"
      | "vision_model"
      | "user"
      | "catalogue"
      | "policy";
    confidence?: number;
    sourceImageId?: string;
    modelVersion?: string;
    promptVersion?: string;
  },
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    insert into scan_evidence (
      scan_id, evidence_type, value, normalized_value, source, confidence,
      source_image_id, model_version, prompt_version
    ) values (
      ${input.scanId}, ${input.evidenceType}, ${sql.json(databaseJson(input.value))}, ${input.normalizedValue ?? null},
      ${input.source}, ${input.confidence ?? null}, ${input.sourceImageId ?? null},
      ${input.modelVersion ?? null}, ${input.promptVersion ?? null}
    )
  `;
}

export async function getEvidence(scanId: string, sql: Sql = getDatabase()) {
  return sql`
    select id, evidence_type, value, normalized_value, source, confidence, source_image_id,
      model_version, prompt_version, created_at
    from scan_evidence where scan_id = ${scanId} order by created_at, id
  `;
}

export async function clearDerivedEvidence(
  scanId: string,
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    delete from scan_evidence where scan_id = ${scanId}
      and source in ('barcode_decoder', 'ocr', 'vision_model', 'policy')
  `;
}

export async function setScanError(
  scanId: string,
  input: { code: string; message: string },
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    update scans set error_code = ${input.code}, error_message = ${input.message}, version = version + 1
    where id = ${scanId}
  `;
}
