import { describe, expect, test } from "bun:test";
import {
  calculateVisualSimilarity,
  isFatalVisualMismatch,
  selectVisualComparisonCandidates,
} from "../src/modules/matching/openai-candidate-verifier";
import type { CanonicalProductCandidate } from "../src/modules/matching/verification";

describe("visual candidate policy", () => {
  test("scores observable similarities without granting exact identity", () => {
    const score = calculateVisualSimilarity({
      relationship: "same_visible_package",
      brandMatch: "match",
      productLineMatch: "match",
      packageFormMatch: "match",
      labelLayoutMatch: "match",
      colorwayMatch: "match",
      variantMarkerMatch: "match",
      sizeMarkerMatch: "match",
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
        productLineMatch: "mismatch",
        packageFormMatch: "match",
        labelLayoutMatch: "match",
        colorwayMatch: "match",
        variantMarkerMatch: "unknown",
        sizeMarkerMatch: "unknown",
        visibleTextOverlap: ["serum"],
        exactVariantVisuallySupported: false,
      }),
    ).toBe(0);
  });

  test("does not turn unknown visual axes into positive evidence", () => {
    const score = calculateVisualSimilarity({
      relationship: "uncertain",
      brandMatch: "unknown",
      productLineMatch: "unknown",
      packageFormMatch: "unknown",
      labelLayoutMatch: "unknown",
      colorwayMatch: "unknown",
      variantMarkerMatch: "unknown",
      sizeMarkerMatch: "unknown",
      visibleTextOverlap: [],
      exactVariantVisuallySupported: false,
    });
    expect(score).toBe(0);
  });

  test("treats a visible variant contradiction as fatal", () => {
    expect(
      isFatalVisualMismatch({
        candidateId: "candidate-red",
        relationship: "same_product_family",
        brandMatch: "match",
        productLineMatch: "match",
        packageFormMatch: "match",
        labelLayoutMatch: "match",
        colorwayMatch: "mismatch",
        variantMarkerMatch: "mismatch",
        sizeMarkerMatch: "unknown",
        visibleTextOverlap: ["Lip Balm"],
        contradictions: [{ field: "shade", buyer: "rose", candidate: "red" }],
        exactVariantVisuallySupported: false,
      }),
    ).toBe(true);
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
    expect(selected).toHaveLength(9);
    expect(selected.map((candidate) => candidate.id)).toContain("candidate-9");
    expect(selected.map((candidate) => candidate.id)).not.toContain(
      "candidate-3",
    );
  });
});
