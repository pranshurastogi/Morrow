export const OPENAI_PRICING_VERSION = "2026-08-02";
export const OPENAI_PRICING_SOURCE =
  "https://developers.openai.com/api/docs/pricing";

const LONG_CONTEXT_THRESHOLD = 272_000;

interface TokenRates {
  input: number;
  cachedInput: number;
  cacheWriteInput: number;
  output: number;
}

interface ModelRates {
  standard: TokenRates;
  longContext?: TokenRates;
}

// USD per one million tokens. The arithmetic below returns integer micro-USD,
// so one rate-table unit is also one micro-dollar per token.
const MODEL_RATES: Record<string, ModelRates> = {
  "gpt-5.6-terra": {
    standard: {
      input: 2,
      cachedInput: 0.2,
      cacheWriteInput: 2.5,
      output: 12,
    },
    longContext: {
      input: 4,
      cachedInput: 0.4,
      cacheWriteInput: 5,
      output: 18,
    },
  },
  "gpt-5.6-sol": {
    standard: {
      input: 5,
      cachedInput: 0.5,
      cacheWriteInput: 6.25,
      output: 30,
    },
    longContext: {
      input: 10,
      cachedInput: 1,
      cacheWriteInput: 12.5,
      output: 45,
    },
  },
  "text-embedding-3-small": {
    standard: {
      input: 0.02,
      cachedInput: 0.02,
      cacheWriteInput: 0.02,
      output: 0,
    },
  },
};

export interface OpenAiTokenUsage {
  inputTokens: number;
  cachedInputTokens?: number;
  cacheWriteInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens: number;
}

function modelFamily(model: string): keyof typeof MODEL_RATES | null {
  if (model === "gpt-5.6" || model.startsWith("gpt-5.6-sol")) {
    return "gpt-5.6-sol";
  }
  if (model.startsWith("gpt-5.6-terra")) return "gpt-5.6-terra";
  if (model.startsWith("text-embedding-3-small")) {
    return "text-embedding-3-small";
  }
  return null;
}

export function isMeteredOpenAiModel(model: string): boolean {
  return modelFamily(model) !== null;
}

function tokenCount(value: number | undefined): number {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("OpenAI returned an invalid token count");
  }
  return value;
}

export function calculateOpenAiCostMicroUsd(input: {
  model: string;
  usage: OpenAiTokenUsage;
}): number {
  const family = modelFamily(input.model);
  if (!family) {
    throw new Error(`No reviewed OpenAI price card exists for ${input.model}`);
  }
  const inputTokens = tokenCount(input.usage.inputTokens);
  const rawCachedTokens = tokenCount(input.usage.cachedInputTokens);
  const rawCacheWriteTokens = tokenCount(input.usage.cacheWriteInputTokens);
  const outputTokens = tokenCount(input.usage.outputTokens);
  tokenCount(input.usage.reasoningOutputTokens);
  tokenCount(input.usage.totalTokens);

  const cachedTokens = Math.min(inputTokens, rawCachedTokens);
  const cacheWriteTokens = Math.min(
    inputTokens - cachedTokens,
    rawCacheWriteTokens,
  );
  const uncachedTokens = Math.max(
    0,
    inputTokens - cachedTokens - cacheWriteTokens,
  );
  const card = MODEL_RATES[family]!;
  const rates =
    inputTokens > LONG_CONTEXT_THRESHOLD && card.longContext
      ? card.longContext
      : card.standard;
  return Math.ceil(
    uncachedTokens * rates.input +
      cachedTokens * rates.cachedInput +
      cacheWriteTokens * rates.cacheWriteInput +
      outputTokens * rates.output,
  );
}

export function reservationMicroUsdForModel(model: string): number {
  const family = modelFamily(model);
  if (!family) {
    throw new Error(`No reviewed OpenAI price card exists for ${model}`);
  }
  if (family === "gpt-5.6-sol") return 2_000_000;
  if (family === "gpt-5.6-terra") return 750_000;
  return 10_000;
}
