import { describe, expect, test } from "bun:test";
import {
  calculateVisualSimilarity,
  selectVisualComparisonCandidates,
} from "../src/modules/matching/openai-candidate-verifier";
import type { CanonicalProductCandidate } from "../src/modules/matching/verification";

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

  test("compares every retrieved finalist with an available image", () => {
    const candidates: CanonicalProductCandidate[] = Array.from(
      { length: 12 },
      (_, index) => ({
        id: `candidate-${index}`,
        category: "skin care",
        brand: "Mamaearth",
        name: `Face Wash ${index}`,
        variant: null,
        size: { value: 50 + index * 50, unit: "ml" },
        gtin: null,
        upc: null,
        ean: null,
        mpn: null,
        modelNumber: null,
        attributes: {},
        retrievalScore: 1,
        imageSimilarity: 0,
        historyMatch: false,
        imageUrl:
          index === 3 ? null : `https://cdn.example/candidate-${index}.png`,
      }),
    );

    const selected = selectVisualComparisonCandidates(candidates);
    expect(selected).toHaveLength(10);
    expect(selected.map((candidate) => candidate.id)).toContain("candidate-10");
    expect(selected.map((candidate) => candidate.id)).not.toContain(
      "candidate-3",
    );
  });
});
