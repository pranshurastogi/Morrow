import { describe, expect, test } from "bun:test";
import { reciprocalRankFusion } from "../src/modules/catalog/catalog-repository";

describe("retrieval rank fusion", () => {
  test("rewards agreement across independent retrieval channels", () => {
    const scores = reciprocalRankFusion([
      { ids: ["outlier", "consensus"], weight: 1 },
      { ids: ["other", "consensus"], weight: 1 },
      { ids: ["consensus", "third"], weight: 1 },
    ]);

    expect(scores.get("consensus") ?? 0).toBeGreaterThan(
      scores.get("outlier") ?? 0,
    );
  });

  test("does not dilute scores with unavailable channels", () => {
    const activeOnly = reciprocalRankFusion([{ ids: ["product"], weight: 1 }]);
    const withUnavailable = reciprocalRankFusion([
      { ids: ["product"], weight: 1 },
      { ids: [], weight: 5 },
    ]);

    expect(withUnavailable.get("product")).toBe(activeOnly.get("product"));
    expect(withUnavailable.get("product")).toBe(1);
  });
});
