import { describe, expect, test } from "bun:test";
import type { NormalizedOffer } from "../src/domain/commerce";
import type { CanonicalProductCandidate } from "../src/modules/matching/verification";
import {
  rankOffers,
  verifyMerchantVariant,
} from "../src/modules/offers/offer-policy";

const product: CanonicalProductCandidate = {
  id: "product",
  category: "skincare",
  brand: "CeraVe",
  name: "Foaming Facial Cleanser",
  variant: null,
  size: { value: 473, unit: "ml" },
  gtin: "3337875597197",
  upc: null,
  ean: null,
  mpn: null,
  modelNumber: null,
  attributes: {},
  retrievalScore: 1,
  imageSimilarity: 1,
  historyMatch: false,
};

function offer(overrides: Partial<NormalizedOffer> = {}): NormalizedOffer {
  return {
    id: "offer",
    provider: "manual",
    merchant: {
      id: "merchant",
      name: "Verified merchant",
      url: "https://merchant.example",
      countryCode: "IN",
      trustScore: 0.9,
      authorizedSeller: true,
    },
    product: {
      externalProductId: "external",
      externalVariantId: "variant-473",
      title: "CeraVe Foaming Facial Cleanser 473 ml",
      imageUrl: null,
      attributes: { gtin: "3337875597197", size_value: "473", size_unit: "ml" },
    },
    price: {
      subtotalMinor: 124_000,
      shippingMinor: null,
      taxMinor: null,
      estimatedTotalMinor: 124_000,
      currency: "INR",
      isBinding: false,
    },
    inventory: { status: "in_stock" },
    delivery: null,
    returns: null,
    identityVerification: { status: "likely", score: 0, contradictions: [] },
    illustrative: false,
    ...overrides,
  };
}

describe("merchant offer policy", () => {
  test("verifies exact merchant identifiers", () => {
    expect(verifyMerchantVariant(product, offer()).status).toBe("verified");
  });

  test("rejects a wrong sellable size before ranking", () => {
    const wrong = offer({
      product: {
        ...offer().product,
        attributes: {
          gtin: "3337875597197",
          size_value: "236",
          size_unit: "ml",
        },
      },
    });
    expect(verifyMerchantVariant(product, wrong).status).toBe("rejected");
  });

  test("hard-filters budget violations", () => {
    const verified = offer({
      identityVerification: {
        status: "verified",
        score: 1,
        contradictions: [],
      },
    });
    const [ranked] = rankOffers([verified], {
      currency: "INR",
      maxTotalMinor: 100_000,
    });
    expect(ranked?.rankingScore).toBe(0);
    expect(ranked?.rejectedReasons).toContain("Exceeds the approved budget");
  });
});
