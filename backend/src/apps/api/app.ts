import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { collectDefaultMetrics, register } from "prom-client";
import { ZodError } from "zod";
import { MorrowError, toMorrowError } from "../../common/errors";
import { fastifyRedactionPaths, redactSensitive } from "../../common/redaction";
import { frontendOrigins, getEnvironment } from "../../config/env";
import { checkDatabase } from "../../infrastructure/database/client";
import { checkRedis } from "../../infrastructure/queue/connection";
import { captureOperationalError } from "../../infrastructure/observability";
import { authPlugin } from "./plugins/auth";
import { offerRoutes } from "./routes/offers";
import { orderRoutes } from "./routes/orders";
import { paymentRoutes } from "./routes/payments";
import { scanRoutes } from "./routes/scans";
import { uploadRoutes } from "./routes/uploads";
import "./types";

let metricsStarted = false;

export async function createApp() {
  const env = getEnvironment();
  const app = Fastify({
    trustProxy: true,
    bodyLimit: 256_000,
    logger: {
      level: env.LOG_LEVEL,
      redact: { paths: [...fastifyRedactionPaths], censor: "[REDACTED]" },
    },
    requestIdHeader: "x-request-id",
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
  await app.register(cors, {
    origin: frontendOrigins(env),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Morrow-User-Id",
      "X-Morrow-User-Email",
      "X-Request-Id",
    ],
    credentials: false,
    maxAge: 86_400,
  });
  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: "1 minute",
  });
  await app.register(sensible);
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Morrow API",
        version: "1.0.0",
        description:
          "Evidence-first product verification and bounded commerce.",
      },
      servers: [
        { url: "http://localhost:3001", description: "Local development" },
      ],
    },
  });
  if (env.NODE_ENV !== "production") {
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }
  await app.register(authPlugin);
  await app.register(uploadRoutes, { prefix: "/v1" });
  await app.register(scanRoutes, { prefix: "/v1" });
  await app.register(offerRoutes, { prefix: "/v1" });
  await app.register(paymentRoutes, { prefix: "/v1" });
  await app.register(orderRoutes, { prefix: "/v1" });

  app.get("/.well-known/ucp", async () => ({
    ucp: {
      version: "2026-04-08",
      services: {
        "dev.ucp.shopping": [
          {
            version: "2026-04-08",
            spec: "https://ucp.dev/2026-04-08/specification/overview",
            transport: "mcp",
            schema:
              "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json",
          },
        ],
      },
      capabilities: {
        "dev.ucp.shopping.catalog.search": [{ version: "2026-04-08" }],
        "dev.ucp.shopping.catalog.lookup": [{ version: "2026-04-08" }],
        "dev.ucp.shopping.cart": [{ version: "2026-04-08" }],
        "dev.ucp.shopping.checkout": [{ version: "2026-04-08" }],
      },
    },
  }));

  app.get("/health", async () => ({ status: "ok", service: "morrow-api" }));
  app.get("/ready", async (_request, reply) => {
    try {
      await Promise.all([checkDatabase(), checkRedis()]);
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "not_ready" });
    }
  });
  if (!metricsStarted) {
    collectDefaultMetrics({ prefix: "morrow_" });
    metricsStarted = true;
  }
  app.get("/metrics", async (_request, reply) => {
    reply.type(register.contentType);
    return register.metrics();
  });

  app.setErrorHandler((error, request, reply) => {
    const mapped =
      error instanceof ZodError
        ? new MorrowError({
            code: "INVALID_REQUEST",
            message: "Request validation failed",
            statusCode: 400,
            details: { issues: error.issues },
          })
        : toMorrowError(error);
    request.log.error(
      { err: redactSensitive(error), code: mapped.code },
      mapped.message,
    );
    captureOperationalError(error, {
      requestId: request.id,
      code: mapped.code,
      path: request.url,
    });
    void reply.code(mapped.statusCode).send({
      error: {
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
        requestId: request.id,
        ...(mapped.details ? { details: redactSensitive(mapped.details) } : {}),
      },
    });
  });

  return app;
}
