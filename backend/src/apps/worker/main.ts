import { Worker } from "bullmq";
import { assertRuntimeConfiguration, getEnvironment } from "../../config/env";
import { closeDatabase } from "../../infrastructure/database/client";
import {
  closeRedis,
  getRedisConnection,
} from "../../infrastructure/queue/connection";
import {
  QUEUE_NAMES,
  scheduleMaintenance,
} from "../../infrastructure/queue/queues";
import { executeCheckout } from "../../modules/checkout/orchestrator";
import { processScan } from "../../modules/recognition/pipeline";
import { runRetentionCleanup } from "../../modules/maintenance/cleanup";
import {
  captureOperationalError,
  startObservability,
  stopObservability,
} from "../../infrastructure/observability";

const env = getEnvironment();
assertRuntimeConfiguration("worker", env);
await startObservability("worker");

const workers = [
  new Worker(
    QUEUE_NAMES.scan,
    async (job) => {
      if (job.name !== "process-scan")
        throw new Error(`Unknown scan job: ${job.name}`);
      await processScan(String(job.data.scanId));
    },
    { connection: getRedisConnection(), concurrency: 3 },
  ),
  new Worker(
    QUEUE_NAMES.checkout,
    async (job) => {
      if (job.name !== "execute-checkout")
        throw new Error(`Unknown checkout job: ${job.name}`);
      await executeCheckout(String(job.data.paymentSessionId));
    },
    { connection: getRedisConnection(), concurrency: 1 },
  ),
  new Worker(
    QUEUE_NAMES.cleanup,
    async (job) => {
      if (job.name !== "retention-cleanup")
        throw new Error(`Unknown cleanup job: ${job.name}`);
      return runRetentionCleanup();
    },
    { connection: getRedisConnection(), concurrency: 1 },
  ),
];

await scheduleMaintenance();

for (const worker of workers) {
  worker.on("completed", (job) =>
    console.info({ queue: worker.name, jobId: job.id }, "job completed"),
  );
  worker.on("failed", (job, error) => {
    captureOperationalError(error, { queue: worker.name, jobId: job?.id });
    console.error(
      { queue: worker.name, jobId: job?.id, error: error.message },
      "job failed",
    );
  });
}

async function shutdown(signal: string) {
  console.info({ signal }, "worker shutting down");
  await Promise.all(workers.map((worker) => worker.close()));
  await closeDatabase();
  await closeRedis();
  await stopObservability();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

console.info(
  { queues: workers.map((worker) => worker.name) },
  "Morrow worker ready",
);
