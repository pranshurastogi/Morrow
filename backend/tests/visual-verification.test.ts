import { describe, expect, test } from "bun:test";
import { calculateVisualSimilarity } from "../src/modules/matching/openai-candidate-verifier";

describe("visual candidate policy", () => {
  test("scores observable similarities without granting exact identity", () => {
    const score = calculateVisualSimilarity({
      relationship: "same_visible_package",
      brandMatch: "match",
      packageShapeSimilarity: 0.95,
      labelLayoutSimilarity: 0.9,
      colorwaySimilarity: 0.9,
      visibleTextOverlap: ["Minimalist", "Niacinamide", "10%"],
      exactVariantVisuallySupported: true,
    });
    expect(score).toBeGreaterThan(0.9);
    expect(score).toBeLessThanOrEqual(1);
  });

  test("hard-zeroes a visible brand or product contradiction", () => {
    expect(
      calculateVisualSimilarity({
        relationship: "different_product",
        brandMatch: "mismatch",
        packageShapeSimilarity: 1,
        labelLayoutSimilarity: 1,
        colorwaySimilarity: 1,
        visibleTextOverlap: ["serum"],
        exactVariantVisuallySupported: false,
      }),
    ).toBe(0);
  });
});
