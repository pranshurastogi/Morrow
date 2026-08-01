import type { ProductObservation } from "../../domain/product-observation";
import { getEnvironment } from "../../config/env";
import { normalizeText } from "../../modules/recognition/normalization";
import { searchUcpCatalog } from "./client";
import {
  brandIndianMerchants,
  merchantByDomain,
  relevantIndianMerchants,
  type UcpMerchantDefinition,
} from "./merchant-registry";
import type { UcpCatalogResult, UcpProduct } from "./schemas";

export type UcpDiscoveryRoute = "global" | "brand_store" | "category_store";

export interface UcpDiscoveryAttempt {
  route: UcpDiscoveryRoute;
  merchant: string;
  queryKind: "exact" | "relaxed";
  status: "succeeded" | "failed";
  productCount: number;
}

export interface UcpDiscoveryReport {
  results: UcpCatalogResult[];
  attempts: UcpDiscoveryAttempt[];
  exactQuery: string;
  relaxedQuery: string | null;
  productCount: number;
}

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

export function buildRelaxedCatalogQuery(
  observation: ProductObservation,
): string | null {
  const terms = [
    observation.brand,
    observation.productName,
    !observation.productName
      ? (observation.subcategory ?? observation.category)
      : null,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);
  const query = terms.join(" ").slice(0, 240);
  return query &&
    normalizeText(query) !== normalizeText(buildCatalogQuery(observation))
    ? query
    : null;
}

function productKey(product: UcpProduct): string {
  const variants = product.variants
    .map(
      (variant) =>
        `${normalizeText(variant.seller?.domain ?? "unknown")}:${variant.id}`,
    )
    .sort()
    .join("|");
  return variants || product.id;
}

interface DiscoveryEndpoint {
  endpoint: string;
  merchant: string;
  route: UcpDiscoveryRoute;
}

function merchantRoute(
  merchant: UcpMerchantDefinition,
  brandStores: Set<string>,
): DiscoveryEndpoint {
  return {
    endpoint: merchant.endpoint,
    merchant: merchant.name,
    route: brandStores.has(merchant.endpoint)
      ? "brand_store"
      : "category_store",
  };
}

function dedupeCatalogResults(results: UcpCatalogResult[]): UcpCatalogResult[] {
  const seen = new Set<string>();
  return results
    .map((result) => ({
      ...result,
      products: result.products.filter((product) => {
        const key = productKey(product);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    }))
    .filter((result) => result.products.length > 0);
}

function endpointMerchant(endpoint: string): string {
  const registry = merchantByDomain(new URL(endpoint).hostname);
  return registry?.name ?? "Shopify Global Catalog";
}

export async function discoverUcpCatalog(input: {
  observation: ProductObservation;
  countryCode: string;
  currency: string;
}): Promise<UcpDiscoveryReport> {
  const env = getEnvironment();
  const exactQuery = buildCatalogQuery(input.observation);
  const relaxedQuery = buildRelaxedCatalogQuery(input.observation);
  if (!env.UCP_ENABLED || !exactQuery) {
    return {
      results: [],
      attempts: [],
      exactQuery,
      relaxedQuery,
      productCount: 0,
    };
  }

  const brandStores = new Set(
    brandIndianMerchants(input.observation.brand).map(
      (merchant) => merchant.endpoint,
    ),
  );
  const targeted = relevantIndianMerchants(
    input.observation,
    env.UCP_MAX_MERCHANTS_PER_SCAN,
  );
  const endpoints = (
    [
      {
        endpoint: env.UCP_GLOBAL_CATALOG_URL,
        merchant: endpointMerchant(env.UCP_GLOBAL_CATALOG_URL),
        route: "global" as const,
      },
      ...targeted.map((merchant) => merchantRoute(merchant, brandStores)),
    ] satisfies DiscoveryEndpoint[]
  ).filter(
    (candidate, index, all) =>
      all.findIndex((item) => item.endpoint === candidate.endpoint) === index,
  );

  const attempts: UcpDiscoveryAttempt[] = [];
  const exactSettled = await Promise.allSettled(
    endpoints.map(async (source) => ({
      source,
      result: await searchUcpCatalog({
        endpoint: source.endpoint,
        query: exactQuery,
        countryCode: input.countryCode,
        currency: input.currency,
        intent:
          "Find the same sellable product shown by the buyer. Do not substitute a different size or variant.",
        limit: env.UCP_MAX_PRODUCTS,
      }),
    })),
  );

  const results: UcpCatalogResult[] = [];
  const emptyEndpoints: DiscoveryEndpoint[] = [];
  let successfulCalls = 0;
  let firstFailure: unknown;
  exactSettled.forEach((settled, index) => {
    const source = endpoints[index]!;
    if (settled.status === "fulfilled") {
      successfulCalls += 1;
      const count = settled.value.result.products.length;
      attempts.push({
        route: source.route,
        merchant: source.merchant,
        queryKind: "exact",
        status: "succeeded",
        productCount: count,
      });
      results.push(settled.value.result);
      if (count === 0 && relaxedQuery) emptyEndpoints.push(source);
      return;
    }
    firstFailure ??= settled.reason;
    attempts.push({
      route: source.route,
      merchant: source.merchant,
      queryKind: "exact",
      status: "failed",
      productCount: 0,
    });
  });

  if (relaxedQuery && emptyEndpoints.length > 0) {
    const relaxedSettled = await Promise.allSettled(
      emptyEndpoints.map(async (source) => ({
        source,
        result: await searchUcpCatalog({
          endpoint: source.endpoint,
          query: relaxedQuery,
          countryCode: input.countryCode,
          currency: input.currency,
          intent:
            "Retrieve only products that could be the photographed item; exact identity will be verified by Morrow policy.",
          limit: env.UCP_MAX_PRODUCTS,
        }),
      })),
    );
    relaxedSettled.forEach((settled, index) => {
      const source = emptyEndpoints[index]!;
      if (settled.status === "fulfilled") {
        successfulCalls += 1;
        attempts.push({
          route: source.route,
          merchant: source.merchant,
          queryKind: "relaxed",
          status: "succeeded",
          productCount: settled.value.result.products.length,
        });
        results.push(settled.value.result);
        return;
      }
      firstFailure ??= settled.reason;
      attempts.push({
        route: source.route,
        merchant: source.merchant,
        queryKind: "relaxed",
        status: "failed",
        productCount: 0,
      });
    });
  }

  if (successfulCalls === 0 && firstFailure) throw firstFailure;
  const deduped = dedupeCatalogResults(results);
  return {
    results: deduped,
    attempts,
    exactQuery,
    relaxedQuery,
    productCount: deduped.reduce(
      (total, result) => total + result.products.length,
      0,
    ),
  };
}
