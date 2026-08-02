import { describe, expect, test } from "bun:test";
import {
  calculateOpenAiCostMicroUsd,
  isMeteredOpenAiModel,
  reservationMicroUsdForModel,
} from "../src/modules/usage/openai-pricing";

describe("OpenAI usage pricing", () => {
  test("prices Terra input and output in integer micro-dollars", () => {
    expect(
      calculateOpenAiCostMicroUsd({
        model: "gpt-5.6-terra",
        usage: {
          inputTokens: 1_000,
          outputTokens: 100,
          totalTokens: 1_100,
        },
      }),
    ).toBe(3_200);
  });

  test("separates cache reads, cache writes, and uncached input", () => {
    expect(
      calculateOpenAiCostMicroUsd({
        model: "gpt-5.6-terra",
        usage: {
          inputTokens: 1_000,
          cachedInputTokens: 400,
          cacheWriteInputTokens: 200,
          outputTokens: 0,
          totalTokens: 1_000,
        },
      }),
    ).toBe(1_380);
  });

  test("uses the documented long-context multiplier above 272K", () => {
    expect(
      calculateOpenAiCostMicroUsd({
        model: "gpt-5.6-sol",
        usage: {
          inputTokens: 272_001,
          outputTokens: 1_000,
          totalTokens: 273_001,
        },
      }),
    ).toBe(2_765_010);
  });

  test("prices text-embedding-3-small input", () => {
    expect(
      calculateOpenAiCostMicroUsd({
        model: "text-embedding-3-small",
        usage: { inputTokens: 1_000, totalTokens: 1_000 },
      }),
    ).toBe(20);
  });

  test("fails closed for an unreviewed model price", () => {
    expect(isMeteredOpenAiModel("unreviewed-model")).toBe(false);
    expect(() => reservationMicroUsdForModel("unreviewed-model")).toThrow();
  });
});
