import postgres, { type Sql } from "postgres";
import { getEnvironment } from "../../config/env";

let database: Sql | undefined;

export function getDatabase(): Sql {
  if (!database) {
    const databaseUrl = getEnvironment().DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required");

    database = postgres(databaseUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      transform: { undefined: null },
    });
  }
  return database;
}

export async function checkDatabase(): Promise<void> {
  await getDatabase()`select 1`;
}

export async function closeDatabase(): Promise<void> {
  if (!database) return;
  await database.end({ timeout: 5 });
  database = undefined;
}
