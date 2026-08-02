import { describe, expect, test } from "bun:test";
import type { NormalizedOffer } from "../src/domain/commerce";
import type { CanonicalProductCandidate } from "../src/modules/matching/verification";
import {
  combineOfferIdentityProof,
  rankOffers,
  verifyCatalogEquivalence,
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

  test("verifies the exact UCP source variant without inventing a barcode", () => {
    const ucpProduct = {
      ...product,
      gtin: null,
      sourceProvider: "shopify_ucp",
      sourceVariantId: "gid://shopify/ProductVariant/30ml",
      sourceMerchantDomain: "minimalistinc.myshopify.com",
    };
    const sourceOffer = offer({
      provider: "shopify_ucp",
      product: {
        ...offer().product,
        attributes: {
          source_variant_id: "gid://shopify/ProductVariant/30ml",
          source_merchant_domain: "minimalistinc.myshopify.com",
          size_value: "473",
          size_unit: "ml",
        },
      },
    });
    expect(verifyMerchantVariant(ucpProduct, sourceOffer).status).toBe(
      "verified",
    );
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

  test("bridges an identifier-verified product to its official brand storefront", () => {
    const storefrontProduct: CanonicalProductCandidate = {
      ...product,
      id: "storefront-product",
      gtin: null,
      name: "CeraVe Foaming Facial Cleanser for Normal to Oily Skin",
      attributes: {},
    };
    const proof = verifyCatalogEquivalence({
      selected: product,
      listingProduct: storefrontProduct,
      officialBrandStore: true,
    });
    expect(proof.status).toBe("verified");
    expect(proof.basis).toBe("brand_store_bridge");
  });

  test("accepts exact size and title evidence from an official brand storefront", () => {
    const selected = { ...product, gtin: null };
    const storefrontProduct: CanonicalProductCandidate = {
      ...selected,
      id: "official-storefront-product",
      name: "CeraVe Foaming Facial Cleanser for Normal to Oily Skin",
    };
    const proof = verifyCatalogEquivalence({
      selected,
      listingProduct: storefrontProduct,
      officialBrandStore: true,
    });
    expect(proof.status).toBe("verified");
    expect(proof.basis).toBe("official_brand_evidence");
  });

  test("accepts a matching official shade when the storefront omits package size", () => {
    const selected: CanonicalProductCandidate = {
      ...product,
      brand: "Dot & Key Skincare",
      name: "Dot & Key Ceramide & Peptide Barrier Repair Lip Balm SPF 50 PA+++ Red Romance 10gm",
      variant: "Red Romance",
      size: { value: 10, unit: "g" },
      gtin: null,
    };
    const storefrontProduct: CanonicalProductCandidate = {
      ...selected,
      id: "dot-key-storefront",
      brand: "Dot & Key",
      name: "Ceramide + Peptide Lip Balm In-Vivo Tested SPF 50+ PA+++",
      size: null,
    };
    const proof = verifyCatalogEquivalence({
      selected,
      listingProduct: storefrontProduct,
      officialBrandStore: true,
    });
    expect(proof.status).toBe("verified");
    expect(proof.basis).toBe("official_brand_evidence");
  });

  test("does not infer an exact size when the storefront omits size and variant", () => {
    const storefrontProduct: CanonicalProductCandidate = {
      ...product,
      id: "size-unknown-storefront",
      gtin: null,
      size: null,
    };
    expect(
      verifyCatalogEquivalence({
        selected: product,
        listingProduct: storefrontProduct,
        officialBrandStore: true,
      }).status,
    ).toBe("likely");
  });

  test("lets catalogue equivalence supply a barcode omitted by the listing", () => {
    expect(
      combineOfferIdentityProof({
        sourceVerification: {
          status: "likely",
          score: 0.2,
          contradictions: ["Merchant listing has no matching exact identifier"],
        },
        equivalence: {
          status: "verified",
          score: 1,
          contradictions: [],
          basis: "same_catalogue_record",
        },
      }),
    ).toEqual({ status: "verified", score: 0.8, contradictions: [] });
  });

  test("does not bridge a retailer title without official-store provenance", () => {
    const retailerProduct: CanonicalProductCandidate = {
      ...product,
      id: "retailer-product",
      gtin: null,
    };
    expect(
      verifyCatalogEquivalence({
        selected: product,
        listingProduct: retailerProduct,
        officialBrandStore: false,
      }).status,
    ).toBe("likely");
  });

  test("rejects a brand-store bridge when the package size differs", () => {
    const wrongSize: CanonicalProductCandidate = {
      ...product,
      id: "wrong-size",
      gtin: null,
      size: { value: 236, unit: "ml" },
    };
    expect(
      verifyCatalogEquivalence({
        selected: product,
        listingProduct: wrongSize,
        officialBrandStore: true,
      }).status,
    ).toBe("rejected");
  });

  test("does not equate a same-brand same-size product from another line", () => {
    const selected: CanonicalProductCandidate = {
      ...product,
      id: "mamaearth-vitamin-c",
      brand: "Mamaearth",
      name: "Mamaearth Vitamin C Face Wash with Vitamin C and Turmeric - 150 ml",
      size: { value: 150, unit: "ml" },
      gtin: null,
    };
    const ubtan: CanonicalProductCandidate = {
      ...selected,
      id: "mamaearth-ubtan",
      name: "Ubtan Natural Glow Face Wash 150 ml",
    };

    const proof = verifyCatalogEquivalence({
      selected,
      listingProduct: ubtan,
      officialBrandStore: true,
    });

    expect(proof.status).toBe("likely");
    expect(proof.basis).toBe("unproven");
  });

  test("rejects a multipack when the verified product is a single unit", () => {
    const selected: CanonicalProductCandidate = {
      ...product,
      id: "mamaearth-vitamin-c",
      brand: "Mamaearth",
      name: "Vitamin C Face Wash with Vitamin C and Turmeric - 150 ml",
      size: { value: 150, unit: "ml" },
      gtin: null,
    };
    const multipack: CanonicalProductCandidate = {
      ...selected,
      id: "mamaearth-vitamin-c-pack-two",
      name: "Vitamin C Face Wash with Vitamin C and Turmeric 150 ml Pack of 2",
    };

    const proof = verifyCatalogEquivalence({
      selected,
      listingProduct: multipack,
      officialBrandStore: true,
    });

    expect(proof.status).toBe("rejected");
    expect(proof.contradictions).toContain("Catalogue pack count differs");
  });

  test("accepts the preserved product line and size from its official store", () => {
    const selected: CanonicalProductCandidate = {
      ...product,
      id: "mamaearth-vitamin-c",
      brand: "Mamaearth",
      name: "Mamaearth Vitamin C Face Wash with Vitamin C and Turmeric - 150 ml",
      size: { value: 150, unit: "ml" },
      gtin: null,
    };
    const exactStorefrontProduct: CanonicalProductCandidate = {
      ...selected,
      id: "mamaearth-vitamin-c-storefront",
      name: "Vitamin C Face Wash with Vitamin C & Turmeric, 150 ml",
    };

    expect(
      verifyCatalogEquivalence({
        selected,
        listingProduct: exactStorefrontProduct,
        officialBrandStore: true,
      }).status,
    ).toBe("verified");
  });
});
