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
export type UcpDiscoveryQueryKind =
  "identifier" | "exact" | "relaxed" | "visual";

export interface UcpDiscoveryAttempt {
  route: UcpDiscoveryRoute;
  merchant: string;
  queryKind: UcpDiscoveryQueryKind;
  query: string;
  status: "succeeded" | "failed";
  productCount: number;
}

export interface UcpDiscoveryReport {
  results: UcpCatalogResult[];
  attempts: UcpDiscoveryAttempt[];
  exactQuery: string;
  relaxedQuery: string | null;
  identifierQuery: string | null;
  visualQueries: string[];
  productCount: number;
  durationMs: number;
}

interface CatalogQuery {
  kind: UcpDiscoveryQueryKind;
  query: string;
}

interface DiscoveryJob {
  source: DiscoveryEndpoint;
  query: CatalogQuery;
}

function distinctPhrases(values: Array<string | null | undefined>): string[] {
  const selected: string[] = [];
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const normalized = normalizeText(trimmed);
    if (!normalized) continue;
    const alreadyCovered = selected.some((existing) => {
      const known = normalizeText(existing);
      return known === normalized || known.includes(normalized);
    });
    if (!alreadyCovered) selected.push(trimmed);
  }
  return selected;
}

export function buildCatalogQuery(observation: ProductObservation): string {
  const hasStrongIdentity = Boolean(
    observation.brand ||
    observation.modelNumber ||
    observation.partNumber ||
    observation.visibleIdentifiers.length > 0,
  );
  const terms = distinctPhrases([
    observation.brand,
    observation.productName,
    observation.modelNumber,
    observation.partNumber,
    observation.variant,
    observation.size
      ? `${observation.size.value} ${observation.size.unit}`
      : null,
    ...(!hasStrongIdentity
      ? [
          observation.subcategory ?? observation.category,
          ...(observation.visualSearchTerms ?? []).slice(0, 4),
          ...observation.distinctiveFeatures.slice(0, 2),
        ]
      : []),
  ]);
  if (terms.length === 0) terms.push(observation.category);
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
    !observation.productName
      ? (observation.visualSearchTerms?.[0] ?? null)
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

export function buildIdentifierCatalogQuery(
  observation: ProductObservation,
): string | null {
  const identifiers = [
    ...observation.visibleIdentifiers
      .filter((identifier) =>
        ["barcode", "model_number", "part_number", "sku"].includes(
          identifier.type,
        ),
      )
      .map((identifier) => identifier.value),
    observation.modelNumber,
    observation.partNumber,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter(Boolean);
  if (identifiers.length === 0) return null;
  return [observation.brand, identifiers[0]]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .slice(0, 180);
}

/**
 * Produces short, independently useful image-led queries. Storefront search
 * commonly drops recall when every visible attribute is packed into one long
 * request, so these queries preserve the object family while varying only the
 * most discriminative visual phrase. They remain evidence-led: no unseen
 * maker, model, or compatibility claim is introduced.
 */
export function buildVisualCatalogQueries(
  observation: ProductObservation,
): string[] {
  const anchor =
    observation.productName ?? observation.subcategory ?? observation.category;
  const candidates = [
    ...(observation.visualSearchTerms ?? []),
    ...observation.distinctiveFeatures,
  ];
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const phrase of candidates) {
    const normalizedPhrase = normalizeText(phrase);
    const anchorTokens = new Set(normalizeText(anchor).split(" "));
    const phraseTokens = new Set(normalizedPhrase.split(" "));
    const sharedTokens = [...anchorTokens].filter((token) =>
      phraseTokens.has(token),
    ).length;
    const phraseAlreadyNamesObject =
      sharedTokens /
        Math.max(1, Math.min(anchorTokens.size, phraseTokens.size)) >=
      0.6;
    const query = distinctPhrases([
      observation.brand &&
      !normalizedPhrase.includes(normalizeText(observation.brand))
        ? observation.brand
        : null,
      phraseAlreadyNamesObject ? null : anchor,
      phrase,
    ])
      .join(" ")
      .slice(0, 160);
    const normalized = normalizeText(query);
    if (
      !normalized ||
      seen.has(normalized) ||
      normalized === normalizeText(buildCatalogQuery(observation)) ||
      normalized === normalizeText(buildRelaxedCatalogQuery(observation) ?? "")
    ) {
      continue;
    }
    seen.add(normalized);
    queries.push(query);
    if (queries.length === 2) break;
  }
  return queries;
}

export function buildCatalogQueryPlan(
  observation: ProductObservation,
): CatalogQuery[] {
  const candidates: CatalogQuery[] = [
    {
      kind: "identifier",
      query: buildIdentifierCatalogQuery(observation) ?? "",
    },
    { kind: "exact", query: buildCatalogQuery(observation) },
    {
      kind: "relaxed",
      query: buildRelaxedCatalogQuery(observation) ?? "",
    },
    ...buildVisualCatalogQueries(observation).map((query) => ({
      kind: "visual" as const,
      query,
    })),
  ];
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const normalized = normalizeText(candidate.query);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
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
  const startedAt = Date.now();
  const env = getEnvironment();
  const exactQuery = buildCatalogQuery(input.observation);
  const relaxedQuery = buildRelaxedCatalogQuery(input.observation);
  const identifierQuery = buildIdentifierCatalogQuery(input.observation);
  const visualQueries = buildVisualCatalogQueries(input.observation);
  const queryPlan = buildCatalogQueryPlan(input.observation);
  if (!env.UCP_ENABLED || !exactQuery) {
    return {
      results: [],
      attempts: [],
      exactQuery,
      relaxedQuery,
      identifierQuery,
      visualQueries,
      productCount: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const brandMerchants = brandIndianMerchants(input.observation.brand);
  const brandStores = new Set(
    brandMerchants.map((merchant) => merchant.endpoint),
  );
  // Global Catalog is the cross-merchant route. When the brand has an
  // allowlisted official storefront, query that store directly instead of
  // fanning the same branded request out to unrelated single-brand stores.
  const targeted =
    brandMerchants.length > 0
      ? brandMerchants
      : relevantIndianMerchants(
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
  const results: UcpCatalogResult[] = [];
  const categoryProductCounts = new Map<string, number>();
  const attemptedCategoryEndpoints = new Set<string>();
  let successfulCalls = 0;
  let firstFailure: unknown;

  const jobsFor = (sources: DiscoveryEndpoint[]): DiscoveryJob[] =>
    sources.flatMap((source) =>
      queryPlan
        .filter(
          (query) =>
            source.route !== "category_store" ||
            !["relaxed", "visual"].includes(query.kind),
        )
        .map((query) => ({ source, query })),
    );
  const executeJobs = async (jobs: DiscoveryJob[]): Promise<void> => {
    for (const job of jobs) {
      if (job.source.route === "category_store") {
        attemptedCategoryEndpoints.add(job.source.endpoint);
      }
    }
    const settledJobs = await Promise.allSettled(
      jobs.map(async ({ source, query }) => ({
        source,
        query,
        result: await searchUcpCatalog({
          endpoint: source.endpoint,
          query: query.query,
          countryCode: input.countryCode,
          currency: input.currency,
          intent:
            "Find the same sellable product shown by the buyer. Do not substitute a different size or variant.",
          limit: env.UCP_MAX_PRODUCTS,
        }),
      })),
    );
    settledJobs.forEach((settled, index) => {
      const job = jobs[index]!;
      const { source, query } = job;
      if (settled.status === "fulfilled") {
        successfulCalls += 1;
        const count = settled.value.result.products.length;
        attempts.push({
          route: source.route,
          merchant: source.merchant,
          queryKind: query.kind,
          query: query.query,
          status: "succeeded",
          productCount: count,
        });
        results.push(settled.value.result);
        if (source.route === "category_store") {
          categoryProductCounts.set(
            source.endpoint,
            (categoryProductCounts.get(source.endpoint) ?? 0) + count,
          );
        }
        return;
      }
      firstFailure ??= settled.reason;
      attempts.push({
        route: source.route,
        merchant: source.merchant,
        queryKind: query.kind,
        query: query.query,
        status: "failed",
        productCount: 0,
      });
    });
  };

  // A recognised brand has only the global catalogue and its official store.
  // Generic objects begin with the global route and the two strongest category
  // stores. The remaining stores are a recall escalation, not latency paid by
  // every scan.
  const primaryEndpointCount =
    brandMerchants.length > 0
      ? endpoints.length
      : Math.min(3, endpoints.length);
  const primaryEndpoints = endpoints.slice(0, primaryEndpointCount);
  const deferredEndpoints = endpoints.slice(primaryEndpointCount);
  await executeJobs(jobsFor(primaryEndpoints));
  const firstStageProductCount = dedupeCatalogResults(results).reduce(
    (total, result) => total + result.products.length,
    0,
  );
  const sufficientFirstStageRecall = Math.min(4, env.UCP_MAX_PRODUCTS);
  if (
    deferredEndpoints.length > 0 &&
    firstStageProductCount < sufficientFirstStageRecall
  ) {
    await executeJobs(jobsFor(deferredEndpoints));
  }

  const emptyEndpoints = endpoints.filter(
    (source) =>
      source.route === "category_store" &&
      attemptedCategoryEndpoints.has(source.endpoint) &&
      (categoryProductCounts.get(source.endpoint) ?? 0) === 0,
  );
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
          query: relaxedQuery,
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
        query: relaxedQuery,
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
    identifierQuery,
    visualQueries,
    productCount: deduped.reduce(
      (total, result) => total + result.products.length,
      0,
    ),
    durationMs: Date.now() - startedAt,
  };
}
