import { z } from "zod";

const booleanFromEnvironment = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const enabledBooleanFromEnvironment = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true");

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  FRONTEND_ORIGINS: z
    .string()
    .default("http://localhost:8080,http://localhost:3000"),
  PUBLIC_APP_URL: z.url().default("http://localhost:8080"),

  DATABASE_URL: z.url().optional(),
  REDIS_URL: z.url().optional(),

  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_BASE_URL: z.url().optional(),
  UPLOAD_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(15_000_000),

  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_VISION_MODEL: z.string().default("gpt-5.6-terra"),
  OPENAI_ESCALATION_MODEL: z.string().default("gpt-5.6-sol"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_REASONING_EFFORT: z
    .enum(["none", "low", "medium", "high"])
    .default("low"),
  OCR_ENABLED: booleanFromEnvironment,

  UCP_ENABLED: enabledBooleanFromEnvironment,
  UCP_GLOBAL_CATALOG_URL: z
    .url()
    .default("https://catalog.shopify.com/api/ucp/mcp"),
  UCP_AGENT_PROFILE_URL: z
    .url()
    .default(
      "https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json",
    ),
  UCP_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(12_000),
  UCP_MAX_PRODUCTS: z.coerce.number().int().min(1).max(20).default(8),

  PRAVA_API_URL: z.url().default("https://sandbox.api.prava.space"),
  PRAVA_SECRET_KEY: z.string().min(1).optional(),
  PRAVA_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  SESSION_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
  MERCHANT_CHECKOUT_EXECUTOR_URL: z.url().optional(),
  MERCHANT_CHECKOUT_EXECUTOR_SECRET: z.string().min(1).optional(),

  AUTH_JWKS_URL: z.url().optional(),
  AUTH_ISSUER: z.string().min(1).optional(),
  AUTH_AUDIENCE: z.string().min(1).optional(),
  ALLOW_DEVELOPMENT_AUTH: booleanFromEnvironment,

  ALLOW_ILLUSTRATIVE_OFFERS: booleanFromEnvironment,
  SENTRY_DSN: z.url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_SERVICE_NAME: z.string().default("morrow-backend"),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;
export type RuntimeRole = "api" | "worker";

let cachedEnvironment: AppEnvironment | undefined;

export function getEnvironment(): AppEnvironment {
  if (!cachedEnvironment) {
    cachedEnvironment = environmentSchema.parse(process.env);
  }
  return cachedEnvironment;
}

export function assertRuntimeConfiguration(
  role: RuntimeRole,
  env = getEnvironment(),
): void {
  const required: Array<keyof AppEnvironment> = ["DATABASE_URL", "REDIS_URL"];

  if (role === "api") {
    required.push(
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "PRAVA_SECRET_KEY",
      "SESSION_TOKEN_ENCRYPTION_KEY",
    );
  } else {
    required.push(
      "R2_ACCOUNT_ID",
      "R2_ACCESS_KEY_ID",
      "R2_SECRET_ACCESS_KEY",
      "R2_BUCKET_NAME",
      "OPENAI_API_KEY",
      "PRAVA_SECRET_KEY",
    );
  }

  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing ${role} environment variables: ${missing.join(", ")}`,
    );
  }

  if (env.NODE_ENV === "production" && env.ALLOW_DEVELOPMENT_AUTH) {
    throw new Error("ALLOW_DEVELOPMENT_AUTH cannot be enabled in production");
  }
  if (role === "api" && env.NODE_ENV === "production" && !env.AUTH_JWKS_URL) {
    throw new Error("AUTH_JWKS_URL is required for the production API");
  }

  if (role === "api" && env.SESSION_TOKEN_ENCRYPTION_KEY) {
    const decoded = Buffer.from(env.SESSION_TOKEN_ENCRYPTION_KEY, "base64");
    if (decoded.byteLength !== 32) {
      throw new Error(
        "SESSION_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
    }
  }

  if (
    Boolean(env.MERCHANT_CHECKOUT_EXECUTOR_URL) !==
    Boolean(env.MERCHANT_CHECKOUT_EXECUTOR_SECRET)
  ) {
    throw new Error(
      "MERCHANT_CHECKOUT_EXECUTOR_URL and MERCHANT_CHECKOUT_EXECUTOR_SECRET must be set together",
    );
  }

  const usesSandbox = env.PRAVA_API_URL.includes("sandbox.api.prava.space");
  const secret = env.PRAVA_SECRET_KEY;
  if (secret) {
    if (usesSandbox && !secret.startsWith("sk_test_")) {
      throw new Error("Sandbox Prava URL requires an sk_test_ key");
    }
    if (!usesSandbox && !secret.startsWith("sk_live_")) {
      throw new Error("Production Prava URL requires an sk_live_ key");
    }
  }
}

export function frontendOrigins(env = getEnvironment()): string[] {
  return env.FRONTEND_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
