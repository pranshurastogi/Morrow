import type { ProductObservation } from "../../domain/product-observation";
import { getEnvironment } from "../../config/env";
import { normalizeText } from "../../modules/recognition/normalization";
import { searchUcpCatalog } from "./client";
import { relevantIndianMerchants } from "./merchant-registry";
import type { UcpCatalogResult, UcpProduct } from "./schemas";

export function buildCatalogQuery(observation: ProductObservation): string {
  const terms = [
    observation.brand,
    observation.productName,
    observation.modelNumber,
    observation.partNumber,
    observation.variant,
    observation.size
      ? `${observation.size.value} ${observation.size.unit}`
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);
  if (terms.length === 0) {
    terms.push(
      observation.subcategory ?? observation.category,
      ...observation.distinctiveFeatures.slice(0, 2),
    );
  }
  return terms.join(" ").slice(0, 300);
}

function productKey(product: UcpProduct): string {
  const variants = product.variants
    .map((variant) => `${normalizeText(variant.seller.domain)}:${variant.id}`)
    .sort()
    .join("|");
  return variants || product.id;
}

export async function discoverUcpCatalog(input: {
  observation: ProductObservation;
  countryCode: string;
  currency: string;
}): Promise<UcpCatalogResult[]> {
  const env = getEnvironment();
  if (!env.UCP_ENABLED) return [];
  const query = buildCatalogQuery(input.observation);
  if (!query) return [];
  const targeted = relevantIndianMerchants(input.observation);
  const endpoints = [
    env.UCP_GLOBAL_CATALOG_URL,
    ...targeted.map((merchant) => merchant.endpoint),
  ].filter((endpoint, index, all) => all.indexOf(endpoint) === index);
  const settled = await Promise.allSettled(
    endpoints.map((endpoint) =>
      searchUcpCatalog({
        endpoint,
        query,
        countryCode: input.countryCode,
        currency: input.currency,
        intent:
          "Find the same sellable product shown by the buyer. Do not substitute a different size or variant.",
        limit: env.UCP_MAX_PRODUCTS,
      }),
    ),
  );
  const successful = settled
    .filter(
      (result): result is PromiseFulfilledResult<UcpCatalogResult> =>
        result.status === "fulfilled",
    )
    .map((result) => result.value);
  if (successful.length === 0) {
    const rejected = settled.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (rejected) throw rejected.reason;
    return [];
  }
  const seen = new Set<string>();
  return successful.map((result) => ({
    ...result,
    products: result.products.filter((product) => {
      const key = productKey(product);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  }));
}
