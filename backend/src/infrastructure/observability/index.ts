import * as Sentry from "@sentry/node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getEnvironment, type RuntimeRole } from "../../config/env";

let telemetry: NodeSDK | undefined;

export async function startObservability(role: RuntimeRole): Promise<void> {
  const env = getEnvironment();
  if (env.SENTRY_DSN) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      serverName: `${env.OTEL_SERVICE_NAME}-${role}`,
      sendDefaultPii: false,
      tracesSampleRate: env.NODE_ENV === "production" ? 0.15 : 1,
    });
  }
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    telemetry = new NodeSDK({
      serviceName: `${env.OTEL_SERVICE_NAME}-${role}`,
      traceExporter: new OTLPTraceExporter({
        url: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      }),
      instrumentations: [getNodeAutoInstrumentations()],
    });
    telemetry.start();
  }
}

export function captureOperationalError(
  error: unknown,
  context: Record<string, unknown>,
): void {
  if (!getEnvironment().SENTRY_DSN) return;
  Sentry.withScope((scope) => {
    scope.setContext("operation", context);
    Sentry.captureException(error);
  });
}

export async function stopObservability(): Promise<void> {
  await telemetry?.shutdown();
  telemetry = undefined;
  await Sentry.close(2_000);
}
