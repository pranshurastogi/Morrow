import { describe, expect, test } from "bun:test";
import type { ProductObservation } from "../src/domain/product-observation";
import {
  buildCatalogQueryPlan,
  buildCatalogQuery,
  buildIdentifierCatalogQuery,
  buildRelaxedCatalogQuery,
} from "../src/integrations/shopify-ucp/discovery";
import { catalogIdentityKey } from "../src/integrations/shopify-ucp/catalog-ingestion";
import {
  normalizeUcpVariant,
  parseCatalogSize,
} from "../src/integrations/shopify-ucp/normalization";
import {
  extractUcpSearchContent,
  ucpCartResponseSchema,
  ucpProductSchema,
  ucpSearchResponseSchema,
} from "../src/integrations/shopify-ucp/schemas";
import { assertAllowedUcpEndpoint } from "../src/integrations/shopify-ucp/client";
import {
  brandIndianMerchants,
  relevantIndianMerchants,
} from "../src/integrations/shopify-ucp/merchant-registry";

const observation: ProductObservation = {
  category: "skincare",
  subcategory: "face serum",
  brand: "Minimalist",
  productName: "Niacinamide 10% Face Serum",
  modelNumber: null,
  partNumber: null,
  variant: null,
  size: { value: 30, unit: "ml" },
  colors: [],
  materials: [],
  visibleIdentifiers: [],
  distinctiveFeatures: [],
  claims: [],
  visualFingerprint: "clear dropper bottle with a black label",
  exactIdentificationPossible: false,
  missingEvidence: ["barcode"],
  suggestedNextCapture: "barcode",
};

describe("Shopify UCP catalogue normalization", () => {
  test("builds a narrow evidence-led query without requiring a barcode", () => {
    expect(buildCatalogQuery(observation)).toBe(
      "Minimalist Niacinamide 10% Face Serum 30 ml",
    );
  });

  test("builds a relaxed fallback query without dropping the observed product", () => {
    expect(buildRelaxedCatalogQuery(observation)).toBe(
      "Minimalist Niacinamide 10% Face Serum",
    );
  });

  test("searches an observed identifier independently from descriptive text", () => {
    const identified = {
      ...observation,
      visibleIdentifiers: [
        {
          type: "barcode" as const,
          value: "8906123456789",
          evidenceBasis: "barcode_decoder" as const,
        },
      ],
    };
    expect(buildIdentifierCatalogQuery(identified)).toBe(
      "Minimalist 8906123456789",
    );
    expect(
      buildCatalogQueryPlan(identified).map((query) => query.kind),
    ).toEqual(["identifier", "exact", "relaxed"]);
  });

  test("routes both the exact brand store and relevant category storefronts", () => {
    const merchants = relevantIndianMerchants(observation, 6);
    expect(merchants[0]?.name).toBe("Minimalist");
    expect(
      merchants.some((merchant) => merchant.category === "skin care"),
    ).toBe(true);

    const categoryOnly = relevantIndianMerchants(
      { ...observation, brand: "Unlisted Laboratory" },
      4,
    );
    expect(categoryOnly).toHaveLength(4);
    expect(
      categoryOnly.every((merchant) => merchant.category.includes("skin care")),
    ).toBe(true);
  });

  test("resolves common brand spellings and registered portfolio aliases", () => {
    expect(brandIndianMerchants("Dot and Key")[0]?.name).toBe("Dot & Key");
    expect(brandIndianMerchants("The Derma Co.")[0]?.name).toBe("TheDermaCo");
    expect(brandIndianMerchants("Rare Rabbit")[0]?.name).toBe(
      "The House of Rare",
    );
    expect(brandIndianMerchants("Bare Anatomy")[0]?.name).toBe("Innovist");
  });

  test("normalizes common catalogue size labels", () => {
    expect(parseCatalogSize("30ml")).toEqual({ value: 30, unit: "ml" });
    expect(parseCatalogSize("16 FL. OZ")).toEqual({
      value: 16,
      unit: "fl_oz",
    });
    expect(parseCatalogSize("0.5 L")).toEqual({ value: 0.5, unit: "l" });
  });

  test("maps a real UCP variant into a source-verifiable merchant listing", () => {
    const product = ucpProductSchema.parse({
      id: "gid://shopify/p/product",
      title: "Niacinamide 10% Face Serum",
      description: { plain: "Minimalist serum" },
      media: [{ type: "image", url: "https://cdn.example/product.png" }],
      variants: [
        {
          id: "gid://shopify/ProductVariant/variant",
          title: "Niacinamide 10% Face Serum",
          url: "https://beminimalist.co/products/serum?variant=1",
          price: { amount: 53900, currency: "INR" },
          availability: { available: true },
          options: [{ name: "Size", label: "30ml" }],
          seller: {
            name: "Minimalist",
            url: "https://beminimalist.co",
            domain: "minimalistinc.myshopify.com",
          },
        },
      ],
    });
    const normalized = normalizeUcpVariant({
      product,
      variant: product.variants[0]!,
      observation,
    });
    expect(normalized.priceMinor).toBe(53900);
    expect(normalized.merchantCountryCode).toBe("IN");
    expect(normalized.size).toEqual({ value: 30, unit: "ml" });
    expect(normalized.merchantEndpoint).toBe(
      "https://minimalistinc.myshopify.com/api/ucp/mcp",
    );
    expect(normalized.attributes.source_variant_id).toBe(
      "gid://shopify/ProductVariant/variant",
    );
  });

  test("accepts a storefront variant that inherits its merchant and URL", () => {
    const product = ucpProductSchema.parse({
      id: "gid://shopify/Product/mamaearth",
      title:
        "Rice Dewy Bright Face Wash With Rice Water & Niacinamide - 150 ml",
      url: "https://mamaearth.in/products/rice-face-wash",
      media: [{ type: "image", url: "https://cdn.example/mamaearth.png" }],
      variants: [
        {
          id: "gid://shopify/ProductVariant/mamaearth",
          title: "Default Title",
          price: { amount: 41900, currency: "INR" },
          availability: { available: true },
          options: [{ name: "Title", label: "Default Title" }],
        },
      ],
    });
    const normalized = normalizeUcpVariant({
      product,
      variant: product.variants[0]!,
      observation: { ...observation, brand: "Mamaearth" },
      sourceEndpoint: "https://mamaearthprod.myshopify.com/api/ucp/mcp",
    });
    expect(normalized.merchantName).toBe("Mamaearth");
    expect(normalized.merchantCountryCode).toBe("IN");
    expect(normalized.productUrl).toBe(
      "https://mamaearth.in/products/rice-face-wash",
    );
    expect(normalized.size).toEqual({ value: 150, unit: "ml" });
    expect(normalized.title).toBe(product.title);
    expect(normalized.variant).toBeNull();
  });

  test("reconciles a brand-prefixed global result with the sellable storefront variant", () => {
    const globalKey = catalogIdentityKey({
      brand: "mamaearth",
      name: "Mamaearth Rice Dewy Bright Face Wash - 200 ml",
      size: { value: 200, unit: "ml" },
      gtin: null,
      variant: "Title: Mamaearth Rice Dewy Bright Face Wash - 200 ml",
      merchantDomain: "catalog.shopify.com",
      attributes: {
        option_title: "Mamaearth Rice Dewy Bright Face Wash - 200 ml",
      },
    });
    const storefrontKey = catalogIdentityKey({
      brand: "Mamaearth",
      name: "Rice Dewy Bright Face Wash - 200 ml",
      size: { value: 200, unit: "ml" },
      gtin: null,
      variant: null,
      merchantDomain: "mamaearthprod.myshopify.com",
      attributes: {},
    });
    const wrongSizeKey = catalogIdentityKey({
      brand: "Mamaearth",
      name: "Rice Dewy Bright Face Wash - 150 ml",
      size: { value: 150, unit: "ml" },
      gtin: null,
      variant: null,
      merchantDomain: "mamaearthprod.myshopify.com",
      attributes: {},
    });

    expect(globalKey).toBe(storefrontKey);
    expect(globalKey).not.toBe(wrongSizeKey);
  });

  test("normalizes both deployed and documented Cart MCP envelopes", () => {
    const cart = {
      id: "gid://shopify/Cart/cart_123",
      currency: "INR",
      totals: [
        { type: "subtotal", amount: 54900 },
        { type: "total", amount: 54900 },
      ],
      continue_url: "https://mamaearth.in/cart/c/cart_123",
      messages: [],
    };
    const response = (structuredContent: unknown) => ({
      jsonrpc: "2.0" as const,
      id: "quote",
      result: { structuredContent },
    });

    expect(
      ucpCartResponseSchema.parse(response(cart)).result?.structuredContent.id,
    ).toBe(cart.id);
    expect(
      ucpCartResponseSchema.parse(response({ cart })).result?.structuredContent
        .id,
    ).toBe(cart.id);
  });

  test("accepts the standard MCP text-content fallback envelope", () => {
    const content = {
      ucp: { version: "2026-04-08" },
      products: [],
      messages: [],
    };
    const response = ucpSearchResponseSchema.parse({
      jsonrpc: "2.0",
      id: "fallback",
      result: {
        content: [{ type: "text", text: JSON.stringify(content) }],
      },
    });
    expect(extractUcpSearchContent(response)?.ucp.version).toBe("2026-04-08");
  });

  test("rejects a catalogue endpoint that could become an SSRF target", () => {
    expect(() =>
      assertAllowedUcpEndpoint("http://127.0.0.1:3000/api/ucp/mcp"),
    ).toThrow("not allowlisted");
    expect(
      assertAllowedUcpEndpoint(
        "https://minimalistinc.myshopify.com/api/ucp/mcp",
      ).hostname,
    ).toBe("minimalistinc.myshopify.com");
  });
});
