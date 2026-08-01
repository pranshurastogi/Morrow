import { getRedisConnection } from "../queue/connection";

export async function rememberJson<T>(
  key: string,
  ttlSeconds: number,
  producer: () => Promise<T>,
): Promise<T> {
  const redis = getRedisConnection();
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;
  const value = await producer();
  await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  return value;
}
