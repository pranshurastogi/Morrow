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
    normalizeText(observation.brand) !== normalizeText(candidate.brand)
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

  const variantMatch =
    observation.variant && candidate.variant
      ? normalizeText(observation.variant) === normalizeText(candidate.variant)
      : null;
  if (variantMatch === true) {
    matchedEvidence.push({
      field: "variant",
      observed: observation.variant!,
      candidate: candidate.variant!,
      weight: 0.1,
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
    normalizeText(observation.brand) === normalizeText(candidate.brand)
  ) {
    identityScore += 0.1;
  }
  if (variantMatch === true) identityScore += 0.1;
  if (candidate.historyMatch) identityScore += 0.12;
  identityScore -= contradictions.length * 0.35;
  identityScore = Math.max(0, Math.min(1, identityScore));

  const exactIdentifierMatch =
    barcodeMatch === true || modelMatch === true || partMatch === true;
  let classification: CandidateClassification;
  if (fatal) classification = "rejected";
  else if (exactIdentifierMatch) classification = "exact_verified";
  else if (identityScore >= 0.78 && sizeMatch !== false)
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
