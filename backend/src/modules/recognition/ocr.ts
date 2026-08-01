import { createWorker } from "tesseract.js";

export interface OcrBlock {
  text: string;
  confidence: number;
}

export async function extractText(image: Buffer): Promise<OcrBlock[]> {
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(image);
    return result.data.text
      .split(/\r?\n/)
      .map((text) => text.trim())
      .filter(Boolean)
      .slice(0, 80)
      .map((text) => ({
        text,
        confidence: Math.max(0, Math.min(1, result.data.confidence / 100)),
      }));
  } finally {
    await worker.terminate();
  }
}
