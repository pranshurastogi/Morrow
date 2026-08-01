import IORedis from "ioredis";
import { getEnvironment } from "../../config/env";

let connection: IORedis | undefined;

export function getRedisConnection(): IORedis {
  if (!connection) {
    const redisUrl = getEnvironment().REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL is required");
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return connection;
}

export async function checkRedis(): Promise<void> {
  const redis = getRedisConnection();
  if (redis.status === "wait") await redis.connect();
  await redis.ping();
}

export async function closeRedis(): Promise<void> {
  if (!connection) return;
  await connection.quit();
  connection = undefined;
}
