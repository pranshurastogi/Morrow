import { describe, expect, test } from "bun:test";
import type { ProductObservation } from "../src/domain/product-observation";
import type { UcpDiscoveryReport } from "../src/integrations/shopify-ucp/discovery";
import type { CanonicalProductCandidate } from "../src/modules/matching/verification";
import {
  discoverProductCandidates,
  type CandidateDiscoveryDependencies,
} from "../src/modules/recognition/candidate-discovery";

const observation: ProductObservation = {
  category: "computer accessories",
  subcategory: "computer mouse",
  brand: null,
  productName: "wireless computer mouse",
  modelNumber: null,
  partNumber: null,
  variant: null,
  size: null,
  colors: ["black"],
  materials: ["plastic"],
  visibleIdentifiers: [],
  distinctiveFeatures: ["scroll wheel"],
  visualSearchTerms: ["wireless computer mouse", "black ergonomic mouse"],
  claims: [],
  visualFingerprint: "black mouse with a central scroll wheel",
  exactIdentificationPossible: false,
  missingEvidence: ["brand", "model number"],
  suggestedNextCapture: "underside",
};

const candidate: CanonicalProductCandidate = {
  id: "11111111-1111-4111-8111-111111111111",
  category: "computer accessories",
  brand: "Portronics",
  name: "Wireless Computer Mouse",
  variant: "Black",
  size: null,
  gtin: null,
  upc: null,
  ean: null,
  mpn: null,
  modelNumber: null,
  attributes: {},
  retrievalScore: 0.5,
  imageSimilarity: 0.45,
  historyMatch: false,
};

const liveCatalog: UcpDiscoveryReport = {
  results: [],
  attempts: [],
  exactQuery: "wireless computer mouse",
  relaxedQuery: "computer mouse",
  identifierQuery: null,
  visualQueries: ["black ergonomic mouse"],
  productCount: 0,
  durationMs: 20,
};

const input = {
  observation,
  userId: "user_test",
  scanId: "22222222-2222-4222-8222-222222222222",
  countryCode: "IN",
  currency: "INR",
};

function dependencies(
  overrides: Partial<CandidateDiscoveryDependencies> = {},
): CandidateDiscoveryDependencies {
  return {
    retrieveCandidates: async () => [candidate],
    discoverUcpCatalog: async () => liveCatalog,
    ingestUcpCatalog: async () => [],
    ...overrides,
  };
}

describe("candidate discovery resilience", () => {
  test("keeps local references when live commerce discovery is unavailable", async () => {
    const result = await discoverProductCandidates(
      input,
      dependencies({
        discoverUcpCatalog: async () => {
          throw new Error("catalogue timeout");
        },
      }),
    );

    expect(result.candidates.map((item) => item.id)).toEqual([candidate.id]);
    expect(result.liveCatalog).toBeNull();
    expect(result.liveCatalogError).toBeInstanceOf(Error);
  });

  test("keeps local references when live catalogue ingestion fails", async () => {
    const result = await discoverProductCandidates(
      input,
      dependencies({
        ingestUcpCatalog: async () => {
          throw new Error("database temporarily unavailable");
        },
      }),
    );

    expect(result.candidates.map((item) => item.id)).toEqual([candidate.id]);
    expect(result.liveCatalog).toBe(liveCatalog);
    expect(result.liveCatalogError).toBeInstanceOf(Error);
  });

  test("returns an empty useful-result state instead of a request failure when only live ingestion fails", async () => {
    const result = await discoverProductCandidates(
      input,
      dependencies({
        retrieveCandidates: async () => [],
        ingestUcpCatalog: async () => {
          throw new Error("database temporarily unavailable");
        },
      }),
    );

    expect(result.candidates).toEqual([]);
    expect(result.liveCatalogError).toBeInstanceOf(Error);
  });
});
