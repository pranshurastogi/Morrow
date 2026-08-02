import type { ProductObservation } from "../../domain/product-observation";
import { discoverUcpCatalog as discoverUcpCatalogFromProvider } from "../../integrations/shopify-ucp/discovery";
import type { UcpDiscoveryReport } from "../../integrations/shopify-ucp/discovery";
import { ingestUcpCatalog as ingestUcpCatalogFromProvider } from "../../integrations/shopify-ucp/catalog-ingestion";
import { retrieveCandidates as retrieveCandidatesFromCatalog } from "../catalog/catalog-repository";
import type { CanonicalProductCandidate } from "../matching/verification";

export interface CandidateDiscoveryResult {
  candidates: CanonicalProductCandidate[];
  liveCatalog: UcpDiscoveryReport | null;
  discoveredProductIds: string[];
  liveCatalogError: unknown | null;
}

export interface CandidateDiscoveryDependencies {
  retrieveCandidates: typeof retrieveCandidatesFromCatalog;
  discoverUcpCatalog: typeof discoverUcpCatalogFromProvider;
  ingestUcpCatalog: typeof ingestUcpCatalogFromProvider;
}

const defaultDependencies: CandidateDiscoveryDependencies = {
  retrieveCandidates: retrieveCandidatesFromCatalog,
  discoverUcpCatalog: discoverUcpCatalogFromProvider,
  ingestUcpCatalog: ingestUcpCatalogFromProvider,
};

/**
 * Local hybrid retrieval and live commerce discovery are independent network
 * operations. Running them together removes one full round trip from every
 * scan while keeping the local catalogue available as a provider fallback.
 */
export async function discoverProductCandidates(
  input: {
    observation: ProductObservation;
    userId: string;
    scanId: string;
    countryCode: string;
    currency: string;
  },
  dependencies: CandidateDiscoveryDependencies = defaultDependencies,
): Promise<CandidateDiscoveryResult> {
  const [local, live] = await Promise.allSettled([
    dependencies.retrieveCandidates({
      observation: input.observation,
      userId: input.userId,
      scanId: input.scanId,
    }),
    dependencies.discoverUcpCatalog({
      observation: input.observation,
      countryCode: input.countryCode,
      currency: input.currency,
    }),
  ]);

  let candidates = local.status === "fulfilled" ? local.value : [];
  if (live.status === "rejected") {
    if (local.status === "rejected") throw local.reason;
    return {
      candidates,
      liveCatalog: null,
      discoveredProductIds: [],
      liveCatalogError: live.reason,
    };
  }

  let discoveredProductIds: string[];
  try {
    discoveredProductIds = await dependencies.ingestUcpCatalog({
      results: live.value.results,
      observation: input.observation,
    });
  } catch (error) {
    if (local.status === "rejected") throw error;
    return {
      candidates,
      liveCatalog: live.value,
      discoveredProductIds: [],
      liveCatalogError: error,
    };
  }
  if (discoveredProductIds.length > 0) {
    try {
      candidates = await dependencies.retrieveCandidates({
        observation: input.observation,
        userId: input.userId,
        scanId: input.scanId,
        preferredProductIds: discoveredProductIds,
      });
    } catch (error) {
      if (local.status === "rejected") throw error;
      return {
        candidates,
        liveCatalog: live.value,
        discoveredProductIds,
        liveCatalogError: error,
      };
    }
  }
  if (local.status === "rejected" && candidates.length === 0) {
    throw local.reason;
  }
  return {
    candidates,
    liveCatalog: live.value,
    discoveredProductIds,
    liveCatalogError: null,
  };
}
