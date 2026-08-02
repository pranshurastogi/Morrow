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
const failures: Array<{
  id: string;
  expectedStatus: string;
  actualStatus: string;
  expectedProductId: string | null;
  actualProductId: string | null;
}> = [];

for (const evaluationCase of manifest.cases) {
  const verifications = evaluationCase.candidates.map((candidate) =>
    verifyCandidate(evaluationCase.observation, candidate),
  );
  const decision = classifyCandidateSet(verifications);
  const actualProductId = decision.selected?.candidateId ?? null;
  const correctDecision = decision.status === evaluationCase.expectedStatus;
  const selectedCorrect = actualProductId === evaluationCase.expectedProductId;
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
    });
  }
}

const total = manifest.cases.length;
const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? null : Number((numerator / denominator).toFixed(4));

console.log(
  JSON.stringify(
    {
      version: manifest.version,
      total,
      decisionAccuracy: ratio(correctDecisionCount, total),
      selectedProductAccuracy: ratio(selectedCorrectCount, total),
      exactPrecision: ratio(correctExactCount, exactClaimCount),
      exactCoverage: ratio(exactClaimCount, total),
      failureCount: failures.length,
      failures,
    },
    null,
    2,
  ),
);
