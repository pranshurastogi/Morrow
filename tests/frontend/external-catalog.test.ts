import { describe, expect, test } from "bun:test";
import type { ScanRecord } from "../../src/features/scan/api/types";
import {
  buildExternalCatalogLinks,
  buildExternalCatalogQuery,
} from "../../src/features/scan/model/external-catalog";

const scan: ScanRecord = {
  id: "scan-reference",
  status: "AMBIGUOUS",
  mode: "exact",
  quantity: 1,
  maxBudgetMinor: null,
  currency: "INR",
  selectedProductId: null,
  errorCode: null,
  errorMessage: null,
  nextCapture: null,
  observation: {
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
    distinctiveFeatures: ["central scroll wheel"],
    visualSearchTerms: ["wireless computer mouse", "black ergonomic mouse"],
    visualFingerprint: "black shell with central wheel",
    exactIdentificationPossible: false,
    missingEvidence: ["brand", "model number"],
    visibleIdentifiers: [],
  },
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

describe("external catalogue fallback", () => {
  test("builds a useful query from a text-free object observation", () => {
    expect(buildExternalCatalogQuery({ scan })).toBe(
      "wireless computer mouse black ergonomic mouse",
    );
  });

  test("creates fixed, encoded marketplace search destinations", () => {
    const links = buildExternalCatalogLinks(
      "wireless computer mouse black ergonomic mouse",
    );
    expect(links).toHaveLength(2);
    expect(new URL(links[0]!.href).hostname).toBe("www.amazon.in");
    expect(new URL(links[0]!.href).searchParams.get("k")).toBe(
      "wireless computer mouse black ergonomic mouse",
    );
    expect(new URL(links[1]!.href).searchParams.get("tbm")).toBe("shop");
  });
});
