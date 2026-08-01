import { getDatabase } from "../../infrastructure/database/client";
import { deleteObject } from "../../infrastructure/storage/r2";

export async function runRetentionCleanup(): Promise<{
  originals: number;
  derivatives: number;
  sessions: number;
}> {
  const sql = getDatabase();
  const originals = await sql`
    select id, object_key from uploads
    where status <> 'DELETED' and created_at < now() - interval '24 hours'
    limit 500
  `;
  let originalCount = 0;
  for (const row of originals) {
    await deleteObject(String(row.object_key));
    await sql`update uploads set status = 'DELETED', deleted_at = now() where id = ${row.id}`;
    originalCount += 1;
  }

  const derivatives = await sql`
    select id, processed_object_key, thumbnail_object_key from scan_images
    where created_at < now() - interval '7 days'
      and (processed_object_key is not null or thumbnail_object_key is not null)
    limit 500
  `;
  let derivativeCount = 0;
  for (const row of derivatives) {
    if (row.processed_object_key)
      await deleteObject(String(row.processed_object_key));
    if (row.thumbnail_object_key)
      await deleteObject(String(row.thumbnail_object_key));
    await sql`
      update scan_images set processed_object_key = null, thumbnail_object_key = null where id = ${row.id}
    `;
    derivativeCount += 1;
  }

  const expiredSessions = await sql`
    update payment_sessions set status = 'EXPIRED', provider_metadata = provider_metadata - 'encryptedSessionToken'
    where expires_at < now() and status in ('PENDING', 'AWAITING_RESULT') returning id
  `;
  await sql`
    update purchase_intents set status = 'EXPIRED', version = version + 1
    where expires_at < now() and status in ('DRAFT', 'APPROVED')
  `;
  await sql`delete from idempotency_records where expires_at < now()`;
  return {
    originals: originalCount,
    derivatives: derivativeCount,
    sessions: expiredSessions.length,
  };
}
