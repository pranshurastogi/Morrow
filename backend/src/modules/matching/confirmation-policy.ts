import { MorrowError } from "../../common/errors";
import type { ScanStatus } from "../../domain/scan-status";
import type { CandidateClassification } from "./verification";

export function assertCandidateMayBeConfirmed(input: {
  scanStatus: ScanStatus;
  classification: CandidateClassification;
  contradictions: Array<{ fatal?: boolean }>;
}): void {
  if (!["SIMILAR_FOUND", "AMBIGUOUS"].includes(input.scanStatus)) {
    throw new MorrowError({
      code: "INVALID_REQUEST",
      message: "This inspection is not waiting for a product choice",
      statusCode: 409,
    });
  }
  if (
    !["exact_verified", "likely_exact", "similar"].includes(
      input.classification,
    )
  ) {
    throw new MorrowError({
      code: "MORE_EVIDENCE_REQUIRED",
      message:
        "This candidate cannot be selected because its identity checks failed",
      statusCode: 409,
    });
  }
  if (input.contradictions.some((item) => item.fatal === true)) {
    throw new MorrowError({
      code: "MORE_EVIDENCE_REQUIRED",
      message: "This candidate has a conflicting identifier or variant",
      statusCode: 409,
    });
  }
}
