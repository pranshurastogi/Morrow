import { createScheduler, createWorker } from "tesseract.js";
import { getEnvironment } from "../../config/env";

export interface OcrBlock {
  text: string;
  confidence: number;
}

type OcrScheduler = ReturnType<typeof createScheduler>;

let schedulerPromise: Promise<OcrScheduler> | null = null;

async function createOcrScheduler(): Promise<OcrScheduler> {
  const scheduler = createScheduler();
  try {
    const workers = await Promise.allSettled(
      Array.from({ length: getEnvironment().OCR_POOL_SIZE }, () =>
        createWorker("eng"),
      ),
    );
    workers.forEach((worker) => {
      if (worker.status === "fulfilled") scheduler.addWorker(worker.value);
    });
    const failure = workers.find((worker) => worker.status === "rejected");
    if (failure?.status === "rejected") throw failure.reason;
    return scheduler;
  } catch (error) {
    await scheduler.terminate().catch(() => undefined);
    throw error;
  }
}

async function getOcrScheduler(): Promise<OcrScheduler> {
  schedulerPromise ??= createOcrScheduler().catch((error) => {
    schedulerPromise = null;
    throw error;
  });
  return schedulerPromise;
}

export async function warmOcrPool(): Promise<void> {
  await getOcrScheduler();
}

export async function closeOcrPool(): Promise<void> {
  const pending = schedulerPromise;
  schedulerPromise = null;
  if (pending) await (await pending).terminate();
}

export async function extractText(image: Buffer): Promise<OcrBlock[]> {
  const result = await (await getOcrScheduler()).addJob("recognize", image);
  return result.data.text
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((text) => ({
      text,
      confidence: Math.max(0, Math.min(1, result.data.confidence / 100)),
    }));
}
