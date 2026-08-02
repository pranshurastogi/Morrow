import type { Candidate } from "../api/types";

export function candidateMayBeSelected(candidate: Candidate): boolean {
  return (
    ["exact_verified", "likely_exact", "similar"].includes(
      candidate.classification,
    ) && !candidate.contradictions.some((item) => item.fatal)
  );
}
