const REDACTED_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "token",
  "dynamic_cvv",
  "dynamicCvv",
  "expiry_month",
  "expiry_year",
  "expiryMonth",
  "expiryYear",
  "session_token",
  "sessionToken",
  "secret",
  "secretKey",
  "password",
  "cvv",
  "cardNumber",
]);

export function redactSensitive<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item)) as T;
  }
  if (!value || typeof value !== "object") return value;

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = REDACTED_KEYS.has(key) ? "[REDACTED]" : redactSensitive(item);
  }
  return result as T;
}

export const fastifyRedactionPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers.set-cookie",
  "*.token",
  "*.dynamic_cvv",
  "*.dynamicCvv",
  "*.session_token",
  "*.sessionToken",
  "*.authorization",
] as const;
