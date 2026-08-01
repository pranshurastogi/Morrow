import { createApp } from "./app";
import { assertRuntimeConfiguration, getEnvironment } from "../../config/env";
import { closeDatabase } from "../../infrastructure/database/client";
import { closeQueues } from "../../infrastructure/queue/queues";
import { closeRedis } from "../../infrastructure/queue/connection";
import {
  startObservability,
  stopObservability,
} from "../../infrastructure/observability";

const env = getEnvironment();
assertRuntimeConfiguration("api", env);
await startObservability("api");
const app = await createApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, "API shutting down");
  await app.close();
  await closeQueues();
  await closeDatabase();
  await closeRedis();
  await stopObservability();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

await app.listen({ host: env.HOST, port: env.PORT });
