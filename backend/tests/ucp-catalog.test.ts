import { describe, expect, test } from "bun:test";
import type { ProductObservation } from "../src/domain/product-observation";
import { buildCatalogQuery } from "../src/integrations/shopify-ucp/discovery";
import {
  normalizeUcpVariant,
  parseCatalogSize,
} from "../src/integrations/shopify-ucp/normalization";
import { ucpProductSchema } from "../src/integrations/shopify-ucp/schemas";
import { assertAllowedUcpEndpoint } from "../src/integrations/shopify-ucp/client";

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
