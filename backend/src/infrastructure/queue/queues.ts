import { Queue, type JobsOptions } from "bullmq";
import { getRedisConnection } from "./connection";

export const QUEUE_NAMES = {
  scan: "scan-processing",
  merchant: "merchant-search",
  checkout: "checkout",
  cleanup: "cleanup",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

const queues = new Map<QueueName, Queue>();

function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getRedisConnection() });
    queues.set(name, queue);
  }
  return queue;
}

const SAFE_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 86_400, count: 2_000 },
  removeOnFail: { age: 604_800, count: 5_000 },
};

export async function enqueueScan(
  scanId: string,
  runKey: string | number,
): Promise<void> {
  await getQueue(QUEUE_NAMES.scan).add(
    "process-scan",
    { scanId },
    {
      ...SAFE_JOB_OPTIONS,
      // A scan can legitimately run again after additional evidence. The run
      // key preserves BullMQ deduplication within a state version without a
      // completed first job suppressing later evidence.
      jobId: `scan:${scanId}:${runKey}`,
    },
  );
}

export async function enqueueCheckout(paymentSessionId: string): Promise<void> {
  await getQueue(QUEUE_NAMES.checkout).add(
    "execute-checkout",
    { paymentSessionId },
    {
      attempts: 1,
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 2_592_000, count: 2_000 },
      jobId: `checkout:${paymentSessionId}`,
    },
  );
}

export async function scheduleMaintenance(): Promise<void> {
  await getQueue(QUEUE_NAMES.cleanup).upsertJobScheduler(
    "hourly-retention-cleanup",
    { every: 60 * 60 * 1_000 },
    { name: "retention-cleanup", data: {} },
  );
}

export async function closeQueues(): Promise<void> {
  await Promise.all(Array.from(queues.values(), (queue) => queue.close()));
  queues.clear();
}
