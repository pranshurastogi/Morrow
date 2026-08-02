import type { ProductObservation } from "../../backend/src/domain/product-observation";
import {
  classifyCandidateSet,
  type CanonicalProductCandidate,
  verifyCandidate,
} from "../../backend/src/modules/matching/verification";

interface EvaluationCase {
  id: string;
  observation: ProductObservation;
  candidates: CanonicalProductCandidate[];
  expectedStatus:
    "EXACT_VERIFIED" | "SIMILAR_FOUND" | "AMBIGUOUS" | "REQUIRES_MORE_EVIDENCE";
  expectedProductId: string | null;
}

interface EvaluationManifest {
  version: string;
  cases: EvaluationCase[];
  gates?: {
    minExactPrecision?: number;
    minRecallAt5?: number;
    minSelectableCoverage?: number;
    maxNoResultRate?: number;
  };
}

const manifestPath = Bun.argv[2];
if (!manifestPath) {
  throw new Error(
    "Usage: bun run eval:recognition <path-to-recognition-manifest.json>",
  );
}

const manifest = (await Bun.file(manifestPath).json()) as EvaluationManifest;
if (!manifest.version || !Array.isArray(manifest.cases)) {
  throw new Error("Recognition manifest must contain version and cases");
}

let correctDecisionCount = 0;
let selectedCorrectCount = 0;
let exactClaimCount = 0;
let correctExactCount = 0;
let candidateResultCount = 0;
let selectedDecisionCount = 0;
let selectableResultCount = 0;
let liveSourceBackedResultCount = 0;
let expectedCandidateCount = 0;
let expectedCandidateFoundCount = 0;
let expectedCandidateSelectableCount = 0;
const recallHits = new Map<number, number>([
  [1, 0],
  [3, 0],
  [5, 0],
  [10, 0],
]);
const failures: Array<{
  id: string;
  expectedStatus: string;
  actualStatus: string;
  expectedProductId: string | null;
  actualProductId: string | null;
  expectedRank: number | null;
}> = [];

for (const evaluationCase of manifest.cases) {
  const verifications = evaluationCase.candidates.map((candidate) =>
    verifyCandidate(evaluationCase.observation, candidate),
  );
  const decision = classifyCandidateSet(verifications);
  const actualProductId = decision.selected?.candidateId ?? null;
  const expectedIndex = evaluationCase.expectedProductId
    ? evaluationCase.candidates.findIndex(
        (candidate) => candidate.id === evaluationCase.expectedProductId,
      )
    : -1;
  const expectedRank = expectedIndex >= 0 ? expectedIndex + 1 : null;
  const selectableIds = new Set(
    verifications
      .filter((verification) =>
        ["exact_verified", "likely_exact", "similar"].includes(
          verification.classification,
        ),
      )
      .map((verification) => verification.candidateId),
  );
  const correctDecision = decision.status === evaluationCase.expectedStatus;
  const selectedCorrect = actualProductId === evaluationCase.expectedProductId;
  if (evaluationCase.candidates.length > 0) candidateResultCount += 1;
  if (decision.selected) selectedDecisionCount += 1;
  if (selectableIds.size > 0) selectableResultCount += 1;
  if (
    evaluationCase.candidates.some(
      (candidate) =>
        selectableIds.has(candidate.id) &&
        ["shopify_ucp", "prava_ucp"].includes(candidate.sourceProvider ?? "") &&
        Boolean(candidate.sourceVariantId),
    )
  ) {
    liveSourceBackedResultCount += 1;
  }
  if (evaluationCase.expectedProductId) {
    expectedCandidateCount += 1;
    if (expectedRank !== null) {
      expectedCandidateFoundCount += 1;
      for (const cutoff of recallHits.keys()) {
        if (expectedRank <= cutoff) {
          recallHits.set(cutoff, (recallHits.get(cutoff) ?? 0) + 1);
        }
      }
    }
    if (selectableIds.has(evaluationCase.expectedProductId)) {
      expectedCandidateSelectableCount += 1;
    }
  }
  if (correctDecision) correctDecisionCount += 1;
  if (selectedCorrect) selectedCorrectCount += 1;
  if (decision.status === "EXACT_VERIFIED") {
    exactClaimCount += 1;
    if (selectedCorrect) correctExactCount += 1;
  }
  if (!correctDecision || !selectedCorrect) {
    failures.push({
      id: evaluationCase.id,
      expectedStatus: evaluationCase.expectedStatus,
      actualStatus: decision.status,
      expectedProductId: evaluationCase.expectedProductId,
      actualProductId,
      expectedRank,
    });
  }
}

const total = manifest.cases.length;
const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? null : Number((numerator / denominator).toFixed(4));

const metrics = {
  decisionAccuracy: ratio(correctDecisionCount, total),
  selectedProductAccuracy: ratio(selectedCorrectCount, total),
  exactPrecision: ratio(correctExactCount, exactClaimCount),
  exactCoverage: ratio(exactClaimCount, total),
  referenceCoverage: ratio(candidateResultCount, total),
  noResultRate: ratio(total - candidateResultCount, total),
  decisionCoverage: ratio(selectedDecisionCount, total),
  selectableCoverage: ratio(selectableResultCount, total),
  liveSourceBackedCoverage: ratio(liveSourceBackedResultCount, total),
  expectedCandidateCoverage: ratio(
    expectedCandidateFoundCount,
    expectedCandidateCount,
  ),
  expectedCandidateSelectableCoverage: ratio(
    expectedCandidateSelectableCount,
    expectedCandidateCount,
  ),
  recallAt1: ratio(recallHits.get(1) ?? 0, expectedCandidateCount),
  recallAt3: ratio(recallHits.get(3) ?? 0, expectedCandidateCount),
  recallAt5: ratio(recallHits.get(5) ?? 0, expectedCandidateCount),
  recallAt10: ratio(recallHits.get(10) ?? 0, expectedCandidateCount),
};

const gateFailures: string[] = [];
const requireMinimum = (
  name: keyof typeof metrics,
  minimum: number | undefined,
) => {
  if (minimum === undefined) return;
  const value = metrics[name];
  if (value === null || value < minimum) {
    gateFailures.push(`${name} ${value ?? "n/a"} is below ${minimum}`);
  }
};
requireMinimum("exactPrecision", manifest.gates?.minExactPrecision);
requireMinimum("recallAt5", manifest.gates?.minRecallAt5);
requireMinimum("selectableCoverage", manifest.gates?.minSelectableCoverage);
if (
  manifest.gates?.maxNoResultRate !== undefined &&
  (metrics.noResultRate === null ||
    metrics.noResultRate > manifest.gates.maxNoResultRate)
) {
  gateFailures.push(
    `noResultRate ${metrics.noResultRate ?? "n/a"} exceeds ${manifest.gates.maxNoResultRate}`,
  );
}

console.log(
  JSON.stringify(
    {
      version: manifest.version,
      total,
      metrics,
      gates: manifest.gates ?? null,
      gatePassed: gateFailures.length === 0,
      gateFailures,
      failureCount: failures.length,
      failures,
    },
    null,
    2,
  ),
);

if (gateFailures.length > 0) process.exitCode = 1;
