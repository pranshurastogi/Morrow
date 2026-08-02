import type {
  NormalizedSize,
  ProductObservation,
} from "../../domain/product-observation";
import {
  jaccardSimilarity,
  normalizeBarcode,
  normalizeIdentifier,
  normalizeText,
  sizesEquivalent,
} from "../recognition/normalization";
import { canonicalBrandName } from "../../integrations/shopify-ucp/merchant-registry";

export interface CanonicalProductCandidate {
  id: string;
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
  attributes: Record<string, unknown>;
  retrievalScore: number;
  imageSimilarity: number;
  historyMatch: boolean;
  imageUrl?: string | null;
  sourceProvider?: string | null;
  sourceProductId?: string | null;
  sourceVariantId?: string | null;
  sourceMerchantDomain?: string | null;
  visualMismatch?: boolean;
  visualContradictions?: string[];
}

export type CandidateClassification =
  "exact_verified" | "likely_exact" | "similar" | "incompatible" | "rejected";

export interface CandidateVerification {
  candidateId: string;
  matchedEvidence: Array<{
    field: string;
    observed: string;
    candidate: string;
    weight: number;
  }>;
  contradictions: Array<{
    field: string;
    observed: string;
    candidate: string;
    fatal: boolean;
  }>;
  identityScore: number;
  purchaseScore: number;
  classification: CandidateClassification;
}

function mayBeSelected(classification: CandidateClassification): boolean {
  return ["exact_verified", "likely_exact", "similar"].includes(classification);
}

/**
 * Presentation rank keeps a safely selectable candidate above a reference-only
 * candidate, then uses measured visual evidence to surface the nearest useful
 * reference. It never changes a verification classification.
 */
export function rankCandidateReferences(
  candidates: CanonicalProductCandidate[],
  verifications: CandidateVerification[],
): CanonicalProductCandidate[] {
  const byId = new Map(
    verifications.map((verification) => [
      verification.candidateId,
      verification,
    ]),
  );
  const score = (candidate: CanonicalProductCandidate): number => {
    const verification = byId.get(candidate.id);
    const identityScore = verification?.identityScore ?? 0;
    const fatalPenalty = verification?.contradictions.some((item) => item.fatal)
      ? 0.35
      : 0;
    return (
      identityScore * 0.62 +
      candidate.imageSimilarity * 0.28 +
      candidate.retrievalScore * 0.1 -
      fatalPenalty
    );
  };
  return [...candidates].sort((left, right) => {
    const leftVerification = byId.get(left.id);
    const rightVerification = byId.get(right.id);
    const leftSelectable = leftVerification
      ? mayBeSelected(leftVerification.classification)
      : false;
    const rightSelectable = rightVerification
      ? mayBeSelected(rightVerification.classification)
      : false;
    if (leftSelectable !== rightSelectable) return leftSelectable ? -1 : 1;
    return score(right) - score(left);
  });
}

function observationBarcode(observation: ProductObservation): string | null {
  for (const identifier of observation.visibleIdentifiers) {
    if (identifier.type !== "barcode") continue;
    const normalized = normalizeBarcode(identifier.value);
    if (normalized) return normalized;
  }
  return null;
}

function candidateBarcodes(candidate: CanonicalProductCandidate): string[] {
  return [candidate.gtin, candidate.upc, candidate.ean]
    .map((value) => (value ? normalizeBarcode(value) : null))
    .filter((value): value is string => value !== null);
}

function sameOptionalIdentifier(
  observed: string | null,
  candidate: string | null,
): boolean | null {
  if (!observed || !candidate) return null;
  return normalizeIdentifier(observed) === normalizeIdentifier(candidate);
}

function equivalentBrand(observed: string, candidate: string): boolean {
  return (
    normalizeText(canonicalBrandName(observed) ?? observed) ===
    normalizeText(canonicalBrandName(candidate) ?? candidate)
  );
}

function sameOptionalPresentation(
  observed: string | null,
  candidate: string | null,
): boolean | null {
  if (!observed || !candidate) return null;
  const left = normalizeText(observed);
  const right = normalizeText(candidate);
  if (!left || !right) return null;
  if (left === right) return true;
  if (
    Math.min(left.length, right.length) >= 4 &&
    (left.includes(right) || right.includes(left))
  ) {
    return true;
  }
  return jaccardSimilarity(left, right) >= 0.72;
}

export function verifyCandidate(
  observation: ProductObservation,
  candidate: CanonicalProductCandidate,
): CandidateVerification {
  const matchedEvidence: CandidateVerification["matchedEvidence"] = [];
  const contradictions: CandidateVerification["contradictions"] = [];
  if (candidate.visualMismatch) {
    contradictions.push({
      field: "visual_identity",
      observed: "The photographed object",
      candidate:
        candidate.visualContradictions?.join("; ") ||
        "Catalogue image depicts a different product",
      fatal: true,
    });
  }
  const barcode = observationBarcode(observation);
  const barcodes = candidateBarcodes(candidate);
  const barcodeMatch = barcode ? barcodes.includes(barcode) : null;
  if (barcodeMatch === true) {
    matchedEvidence.push({
      field: "barcode",
      observed: barcode!,
      candidate: barcode!,
      weight: 0.55,
    });
  } else if (barcode && barcodes.length > 0) {
    contradictions.push({
      field: "barcode",
      observed: barcode,
      candidate: barcodes[0]!,
      fatal: true,
    });
  }

  const modelMatch = sameOptionalIdentifier(
    observation.modelNumber,
    candidate.modelNumber,
  );
  if (modelMatch === true) {
    matchedEvidence.push({
      field: "model_number",
      observed: observation.modelNumber!,
      candidate: candidate.modelNumber!,
      weight: 0.35,
    });
  } else if (modelMatch === false) {
    contradictions.push({
      field: "model_number",
      observed: observation.modelNumber!,
      candidate: candidate.modelNumber!,
      fatal: true,
    });
  }

  const partMatch = sameOptionalIdentifier(
    observation.partNumber,
    candidate.mpn,
  );
  if (partMatch === true) {
    matchedEvidence.push({
      field: "part_number",
      observed: observation.partNumber!,
      candidate: candidate.mpn!,
      weight: 0.35,
    });
  } else if (partMatch === false) {
    contradictions.push({
      field: "part_number",
      observed: observation.partNumber!,
      candidate: candidate.mpn!,
      fatal: true,
    });
  }

  const sizeMatch =
    observation.size && candidate.size
      ? sizesEquivalent(observation.size, candidate.size)
      : null;
  if (sizeMatch === true) {
    matchedEvidence.push({
      field: "size",
      observed: `${observation.size!.value} ${observation.size!.unit}`,
      candidate: `${candidate.size!.value} ${candidate.size!.unit}`,
      weight: 0.1,
    });
  } else if (sizeMatch === false) {
    contradictions.push({
      field: "size",
      observed: `${observation.size!.value} ${observation.size!.unit}`,
      candidate: `${candidate.size!.value} ${candidate.size!.unit}`,
      fatal: true,
    });
  }

  const observedTitle = [
    observation.brand,
    observation.productName,
    observation.variant,
  ]
    .filter(Boolean)
    .join(" ");
  const candidateTitle = [candidate.brand, candidate.name, candidate.variant]
    .filter(Boolean)
    .join(" ");
  const textSimilarity = jaccardSimilarity(observedTitle, candidateTitle);
  if (textSimilarity >= 0.55) {
    matchedEvidence.push({
      field: "title",
      observed: observedTitle,
      candidate: candidateTitle,
      weight: 0.12,
    });
  }

  if (
    observation.brand &&
    candidate.brand &&
    !equivalentBrand(observation.brand, candidate.brand)
  ) {
    contradictions.push({
      field: "brand",
      observed: observation.brand,
      candidate: candidate.brand,
      fatal: true,
    });
  } else if (observation.brand && candidate.brand) {
    matchedEvidence.push({
      field: "brand",
      observed: observation.brand,
      candidate: candidate.brand,
      weight: 0.1,
    });
  }

  const variantMatch = sameOptionalPresentation(
    observation.variant,
    candidate.variant,
  );
  if (variantMatch === true) {
    matchedEvidence.push({
      field: "variant",
      observed: observation.variant!,
      candidate: candidate.variant!,
      weight: 0.1,
    });
  } else if (variantMatch === false) {
    contradictions.push({
      field: "variant",
      observed: observation.variant!,
      candidate: candidate.variant!,
      fatal: true,
    });
  }

  if (candidate.imageSimilarity >= 0.6) {
    matchedEvidence.push({
      field: "visual_package",
      observed: "Photographed presentation",
      candidate: "Catalogue presentation",
      weight: 0.18,
    });
  }

  const fatal = contradictions.some((item) => item.fatal);
  let identityScore = 0;
  if (barcodeMatch === true) identityScore += 0.5;
  if (modelMatch === true || partMatch === true) identityScore += 0.35;
  identityScore += textSimilarity * 0.25;
  identityScore += Math.max(0, Math.min(1, candidate.imageSimilarity)) * 0.25;
  if (sizeMatch === true) identityScore += 0.2;
  if (
    observation.brand &&
    candidate.brand &&
    equivalentBrand(observation.brand, candidate.brand)
  ) {
    identityScore += 0.1;
  }
  if (variantMatch === true) identityScore += 0.1;
  if (candidate.historyMatch) identityScore += 0.12;
  identityScore -= contradictions.length * 0.35;
  identityScore = Math.max(0, Math.min(1, identityScore));

  const exactIdentifierMatch =
    barcodeMatch === true || modelMatch === true || partMatch === true;
  const corroboratingFields = new Set(
    matchedEvidence
      .filter(
        (item) =>
          item.field !== "barcode" &&
          item.field !== "model_number" &&
          item.field !== "part_number",
      )
      .map((item) => item.field),
  ).size;
  let classification: CandidateClassification;
  if (fatal) classification = "rejected";
  else if (exactIdentifierMatch) classification = "exact_verified";
  else if (
    identityScore >= 0.78 &&
    sizeMatch !== false &&
    corroboratingFields >= 3
  )
    classification = "likely_exact";
  else if (identityScore >= 0.45) classification = "similar";
  else classification = "rejected";

  return {
    candidateId: candidate.id,
    matchedEvidence,
    contradictions,
    identityScore,
    purchaseScore: fatal
      ? 0
      : Math.max(0, identityScore - (exactIdentifierMatch ? 0 : 0.08)),
    classification,
  };
}

export function classifyCandidateSet(verifications: CandidateVerification[]): {
  status:
    "EXACT_VERIFIED" | "SIMILAR_FOUND" | "AMBIGUOUS" | "REQUIRES_MORE_EVIDENCE";
  selected: CandidateVerification | null;
} {
  const ranked = [...verifications]
    .filter(
      (item) =>
        item.classification !== "rejected" &&
        item.classification !== "incompatible",
    )
    .sort((a, b) => b.identityScore - a.identityScore);
  const first = ranked[0];
  if (!first) return { status: "REQUIRES_MORE_EVIDENCE", selected: null };
  const second = ranked[1];
  if (second && first.identityScore - second.identityScore < 0.08) {
    return { status: "AMBIGUOUS", selected: null };
  }
  if (first.classification === "exact_verified")
    return { status: "EXACT_VERIFIED", selected: first };
  return { status: "SIMILAR_FOUND", selected: first };
}
