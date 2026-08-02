import type { ProductObservation } from "../../domain/product-observation";
import { discoverUcpCatalog } from "../../integrations/shopify-ucp/discovery";
import type { UcpDiscoveryReport } from "../../integrations/shopify-ucp/discovery";
import { ingestUcpCatalog } from "../../integrations/shopify-ucp/catalog-ingestion";
import { retrieveCandidates } from "../catalog/catalog-repository";
import type { CanonicalProductCandidate } from "../matching/verification";

export interface CandidateDiscoveryResult {
  candidates: CanonicalProductCandidate[];
  liveCatalog: UcpDiscoveryReport | null;
  discoveredProductIds: string[];
  liveCatalogError: unknown | null;
}

/**
 * Local hybrid retrieval and live commerce discovery are independent network
 * operations. Running them together removes one full round trip from every
 * scan while keeping the local catalogue available as a provider fallback.
 */
export async function discoverProductCandidates(input: {
  observation: ProductObservation;
  userId: string;
  scanId: string;
  countryCode: string;
  currency: string;
}): Promise<CandidateDiscoveryResult> {
  const [local, live] = await Promise.allSettled([
    retrieveCandidates({
      observation: input.observation,
      userId: input.userId,
      scanId: input.scanId,
    }),
    discoverUcpCatalog({
      observation: input.observation,
      countryCode: input.countryCode,
      currency: input.currency,
    }),
  ]);

  if (local.status === "rejected") throw local.reason;
  let candidates = local.value;
  if (live.status === "rejected") {
    if (candidates.length === 0) throw live.reason;
    return {
      candidates,
      liveCatalog: null,
      discoveredProductIds: [],
      liveCatalogError: live.reason,
    };
  }

  const discoveredProductIds = await ingestUcpCatalog({
    results: live.value.results,
    observation: input.observation,
  });
  if (discoveredProductIds.length > 0) {
    candidates = await retrieveCandidates({
      observation: input.observation,
      userId: input.userId,
      scanId: input.scanId,
      preferredProductIds: discoveredProductIds,
    });
  }
  return {
    candidates,
    liveCatalog: live.value,
    discoveredProductIds,
    liveCatalogError: null,
  };
}
