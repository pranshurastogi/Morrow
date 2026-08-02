import { describe, expect, test } from "bun:test";
import type { ProductObservation } from "../src/domain/product-observation";
import {
  classifyCandidateSet,
  type CanonicalProductCandidate,
  verifyCandidate,
} from "../src/modules/matching/verification";

const observation: ProductObservation = {
  category: "skincare",
  subcategory: "cleanser",
  brand: "CeraVe",
  productName: "Foaming Facial Cleanser",
  modelNumber: null,
  partNumber: null,
  variant: "Normal to Oily Skin",
  size: { value: 473, unit: "ml" },
  colors: ["green", "white"],
  materials: [],
  visibleIdentifiers: [
    {
      type: "barcode",
      value: "3337875597197",
      evidenceBasis: "barcode_decoder",
    },
  ],
  distinctiveFeatures: [],
  claims: [],
  visualFingerprint: "white pump bottle with green label",
  exactIdentificationPossible: true,
  missingEvidence: [],
  suggestedNextCapture: "none",
};

function candidate(
  overrides: Partial<CanonicalProductCandidate> = {},
): CanonicalProductCandidate {
  return {
    id: "product-1",
    category: "skincare",
    brand: "CeraVe",
    name: "Foaming Facial Cleanser",
    variant: "Normal to Oily Skin",
    size: { value: 473, unit: "ml" },
    gtin: "3337875597197",
    upc: null,
    ean: null,
    mpn: null,
    modelNumber: null,
    attributes: {},
    retrievalScore: 1,
    imageSimilarity: 0.92,
    historyMatch: false,
    ...overrides,
  };
}

describe("candidate verification", () => {
  test("requires an exact identifier and no fatal contradiction for exact verification", () => {
    const result = verifyCandidate(observation, candidate());
    expect(result.classification).toBe("exact_verified");
    expect(result.contradictions).toHaveLength(0);
    expect(result.matchedEvidence.map((item) => item.field)).toContain(
      "barcode",
    );
  });

  test("rejects a visually similar wrong barcode", () => {
    const result = verifyCandidate(
      observation,
      candidate({ gtin: "3337875597005" }),
    );
    expect(result.classification).toBe("rejected");
    expect(result.purchaseScore).toBe(0);
    expect(result.contradictions[0]?.field).toBe("barcode");
  });

  test("rejects a conflicting visible variant even inside one product family", () => {
    const result = verifyCandidate(
      { ...observation, visibleIdentifiers: [] },
      candidate({ gtin: null, variant: "Hydrating Cream-to-Foam" }),
    );
    expect(result.classification).toBe("rejected");
    expect(result.contradictions.map((item) => item.field)).toContain(
      "variant",
    );
  });

  test("normalizes a registered brand alias before contradiction policy", () => {
    const result = verifyCandidate(
      {
        ...observation,
        brand: "Dot & Key Skincare",
        productName: "Ceramide Lip Balm",
        variant: "Red Romance",
        size: null,
        visibleIdentifiers: [],
      },
      candidate({
        brand: "Dot & Key",
        name: "Ceramide Lip Balm",
        variant: "Red Romance",
        size: null,
        gtin: null,
      }),
    );
    expect(result.contradictions.map((item) => item.field)).not.toContain(
      "brand",
    );
  });

  test("does not convert a close pair into an arbitrary exact choice", () => {
    const first = verifyCandidate(
      {
        ...observation,
        visibleIdentifiers: [],
        exactIdentificationPossible: false,
      },
      candidate({ id: "first", gtin: null }),
    );
    const second = {
      ...first,
      candidateId: "second",
      identityScore: first.identityScore - 0.03,
    };
    expect(classifyCandidateSet([first, second]).status).toBe("AMBIGUOUS");
  });

  test("does not arbitrarily select between duplicate exact records", () => {
    const first = verifyCandidate(observation, candidate({ id: "first" }));
    const second = {
      ...verifyCandidate(observation, candidate({ id: "second" })),
      identityScore: first.identityScore - 0.01,
    };
    expect(classifyCandidateSet([first, second]).status).toBe("AMBIGUOUS");
  });
});
