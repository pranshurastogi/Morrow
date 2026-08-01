import type {
  NormalizedSize,
  ProductObservation,
} from "../../domain/product-observation";
import { normalizeText } from "../../modules/recognition/normalization";
import { merchantByDomain } from "./merchant-registry";
import type { UcpProduct, UcpVariant } from "./schemas";

const SIZE_PATTERN =
  /(?:^|\b)(\d+(?:[.,]\d+)?)\s*(fl\.?\s*oz|millilit(?:er|re)s?|ml|lit(?:er|re)s?|ltr|l|kilograms?|kg|grams?|gm|g|ounces?|oz|millimet(?:er|re)s?|mm|centimet(?:er|re)s?|cm|meters?|metres?|m|inches?|inch|in)(?:\b|$)/i;

const UNIT_ALIASES: Record<string, NormalizedSize["unit"]> = {
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  ltr: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  g: "g",
  gm: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  floz: "fl_oz",
  mm: "mm",
  millimeter: "mm",
  millimeters: "mm",
  millimetre: "mm",
  millimetres: "mm",
  cm: "cm",
  centimeter: "cm",
  centimeters: "cm",
  centimetre: "cm",
  centimetres: "cm",
  m: "m",
  meter: "m",
  meters: "m",
  metre: "m",
  metres: "m",
  in: "in",
  inch: "in",
  inches: "in",
};

export function parseCatalogSize(
  ...values: Array<string | null | undefined>
): NormalizedSize | null {
  for (const value of values) {
    if (!value) continue;
    const match = value.match(SIZE_PATTERN);
    if (!match?.[1] || !match[2]) continue;
    const amount = Number(match[1].replace(",", "."));
    const key = match[2].toLowerCase().replace(/[.\s]/g, "");
    const unit = UNIT_ALIASES[key];
    if (Number.isFinite(amount) && amount > 0 && unit) {
      return { value: amount, unit };
    }
  }
  return null;
}

function recordString(value: object, ...names: string[]): string | null {
  const record = value as Record<string, unknown>;
  for (const name of names) {
    const candidate = record[name];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function inferredBrand(
  product: UcpProduct,
  variant: UcpVariant,
  observation: ProductObservation,
  registryMerchantName: string | null,
): string | null {
  const declared = recordString(product, "brand", "vendor", "manufacturer");
  if (declared) return declared;
  const observed = observation.brand?.trim();
  if (observed) {
    const visibleSource = normalizeText(
      [
        product.title,
        product.description?.plain,
        variant.title,
        variant.description?.plain,
        variant.seller?.name,
        registryMerchantName,
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (visibleSource.includes(normalizeText(observed))) return observed;
  }
  return registryMerchantName;
}

function hostnameFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface NormalizedUcpVariant {
  category: string;
  brand: string | null;
  name: string;
  variant: string | null;
  size: NormalizedSize | null;
  gtin: string | null;
  upc: string | null;
  ean: string | null;
  mpn: string | null;
  modelNumber: string | null;
  imageUrl: string | null;
  merchantName: string;
  merchantCountryCode: string | null;
  merchantPublicDomain: string;
  merchantUcpDomain: string;
  merchantEndpoint: string;
  externalProductId: string;
  externalVariantId: string;
  productUrl: string;
  checkoutUrl: string | null;
  title: string;
  priceMinor: number;
  currency: string;
  availability: "in_stock" | "out_of_stock" | "unknown";
  attributes: Record<string, string>;
}

export function normalizeUcpVariant(input: {
  product: UcpProduct;
  variant: UcpVariant;
  observation: ProductObservation;
  sourceEndpoint?: string;
  sourceMerchantCountryCode?: string;
}): NormalizedUcpVariant {
  const {
    product,
    variant,
    observation,
    sourceEndpoint,
    sourceMerchantCountryCode,
  } = input;
  const meaningfulOptions = variant.options.filter(
    // Shopify uses `Title` as the synthetic option for single-variant
    // products. It is not a real variant dimension and must not split the same
    // product between Global Catalog and a merchant storefront.
    (option) => normalizeText(option.name) !== "title",
  );
  const optionText = meaningfulOptions
    .map((option) => `${option.name}: ${option.label}`)
    .join(" · ");
  const sizeOption = meaningfulOptions.find((option) =>
    /size|volume|weight|capacity/i.test(option.name),
  );
  const size = parseCatalogSize(
    sizeOption?.label,
    optionText,
    variant.title,
    product.title,
  );
  const sourceHost = hostnameFromUrl(sourceEndpoint);
  const variantHost = hostnameFromUrl(
    variant.url ?? variant.checkout_url ?? product.url,
  );
  const sellerHost =
    variant.seller?.domain?.toLowerCase().replace(/^www\./, "") ??
    hostnameFromUrl(variant.seller?.url);
  const registryMerchant = [sellerHost, variantHost, sourceHost]
    .filter((value): value is string => Boolean(value))
    .map((domain) => merchantByDomain(domain))
    .find(Boolean);
  const merchantPublicDomain =
    hostnameFromUrl(variant.seller?.url) ??
    variantHost ??
    registryMerchant?.domain ??
    sellerHost ??
    sourceHost ??
    "catalog.shopify.com";
  const merchantUcpDomain =
    registryMerchant !== undefined
      ? new URL(registryMerchant.endpoint).hostname
      : (sellerHost ?? sourceHost ?? merchantPublicDomain);
  const merchantEndpoint =
    registryMerchant?.endpoint ??
    sourceEndpoint ??
    `https://${merchantUcpDomain.replace(/^https?:\/\//, "")}/api/ucp/mcp`;
  const imageUrl = variant.media[0]?.url ?? product.media[0]?.url ?? null;
  const barcode = recordString(variant, "barcode", "gtin", "ean", "upc");
  const gtin = recordString(variant, "gtin") ?? barcode;
  const options = Object.fromEntries(
    meaningfulOptions.map((option) => [
      `option_${normalizeText(option.name).replaceAll(" ", "_")}`,
      option.label,
    ]),
  );
  const listingTitle = /^default title$/i.test(variant.title.trim())
    ? product.title
    : variant.title;
  const productUrl =
    variant.url ??
    product.url ??
    variant.checkout_url ??
    variant.seller?.url ??
    `https://${merchantPublicDomain}`;
  return {
    category: observation.subcategory ?? observation.category,
    brand: inferredBrand(
      product,
      variant,
      observation,
      registryMerchant?.name ?? null,
    ),
    name: product.title,
    variant:
      optionText ||
      (variant.title !== product.title &&
      !/^default title$/i.test(variant.title)
        ? variant.title
        : null),
    size,
    gtin,
    upc: recordString(variant, "upc"),
    ean: recordString(variant, "ean"),
    mpn: recordString(variant, "mpn", "part_number"),
    modelNumber: recordString(variant, "model_number", "model"),
    imageUrl,
    merchantName:
      variant.seller?.name ?? registryMerchant?.name ?? merchantPublicDomain,
    merchantCountryCode:
      registryMerchant !== undefined
        ? "IN"
        : (sourceMerchantCountryCode?.toUpperCase() ?? null),
    merchantPublicDomain,
    merchantUcpDomain,
    merchantEndpoint,
    externalProductId: product.id,
    externalVariantId: variant.id,
    productUrl,
    checkoutUrl: variant.checkout_url ?? null,
    title: listingTitle,
    priceMinor: variant.price.amount,
    currency: variant.price.currency.toUpperCase(),
    availability:
      variant.availability?.available === true
        ? "in_stock"
        : variant.availability?.available === false
          ? "out_of_stock"
          : "unknown",
    attributes: {
      source_provider: "shopify_ucp",
      source_product_id: product.id,
      source_variant_id: variant.id,
      source_merchant_domain: merchantUcpDomain,
      ...(sourceMerchantCountryCode
        ? { merchant_country_code: sourceMerchantCountryCode.toUpperCase() }
        : {}),
      ucp_endpoint: merchantEndpoint,
      ...(size ? { size_value: String(size.value), size_unit: size.unit } : {}),
      ...(gtin ? { gtin } : {}),
      ...(recordString(variant, "sku")
        ? { sku: recordString(variant, "sku")! }
        : {}),
      ...(variant.checkout_url ? { checkout_url: variant.checkout_url } : {}),
      native_checkout: String(variant.eligible?.native_checkout === true),
      ...options,
    },
  };
}
