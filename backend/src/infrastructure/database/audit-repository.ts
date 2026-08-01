import type { Sql } from "postgres";
import { getDatabase } from "./client";
import { databaseJson } from "./json";

export type AuditActor = "user" | "api" | "worker" | "provider" | "policy";

export async function writeAuditEvent(
  input: {
    userId?: string;
    entityType: string;
    entityId: string;
    eventType: string;
    actorType: AuditActor;
    actorId?: string;
    payload?: Record<string, unknown>;
  },
  sql: Sql = getDatabase(),
): Promise<void> {
  await sql`
    insert into audit_events (
      user_id, entity_type, entity_id, event_type, actor_type, actor_id, payload
    ) values (
      ${input.userId ?? null}, ${input.entityType}, ${input.entityId}, ${input.eventType},
      ${input.actorType}, ${input.actorId ?? null}, ${sql.json(databaseJson(input.payload ?? {}))}
    )
  `;
}
