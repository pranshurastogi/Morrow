import { Plate, StatusStamp } from "@/components/morrow/bits";
import { Button } from "@/components/ui/button";
import type { Candidate } from "../api/types";
import { candidateMayBeSelected } from "../model/candidate-presentation";

export function CandidateReferenceCard({
  candidate,
  index,
  onConfirm,
}: {
  candidate: Candidate;
  index: number;
  onConfirm: (productId: string) => void;
}) {
  const selectable = candidateMayBeSelected(candidate);
  const liveAlternative =
    candidate.classification === "similar" &&
    ["shopify_ucp", "prava_ucp"].includes(candidate.source_provider ?? "");
  const firstContradiction = candidate.contradictions[0];
  const title = `${candidate.brand ? `${candidate.brand} ` : ""}${candidate.name}`;

  return (
    <Plate as="article" className="p-4">
      <div className="flex gap-3">
        {candidate.image_url ? (
          <img
            src={candidate.image_url}
            alt={`${title} catalogue reference`}
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 border border-border bg-ivory object-contain p-1"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label-caps text-muted-foreground">
                Candidate {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 font-display text-lg leading-tight">
                {title}
              </h3>
            </div>
            <StatusStamp tone={selectable ? "similar" : "unverified"}>
              {!selectable
                ? "Reference only"
                : candidate.classification === "exact_verified"
                  ? "Exact evidence"
                  : candidate.classification === "likely_exact"
                    ? "Likely"
                    : liveAlternative
                      ? "Live alternative"
                      : "Alternative"}
            </StatusStamp>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              candidate.variant,
              candidate.size_value
                ? `${candidate.size_value} ${candidate.size_unit}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Variant not exposed"}
          </p>
          <p className="mt-2 font-mono text-[11px] text-brass">
            Evidence strength {Number(candidate.identity_score).toFixed(2)}
          </p>
          {liveAlternative && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              A connected merchant listing. Choose it explicitly to compare its
              current dispatch and open the Prava sandbox check.
            </p>
          )}
          {!selectable && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {firstContradiction
                ? `Not selectable: ${firstContradiction.field.replaceAll("_", " ")} differs from the photograph.`
                : "The shape or product family is nearby, but exact identity and variant are not established."}
            </p>
          )}
        </div>
      </div>
      {selectable && (
        <Button
          className="mt-4 min-h-11 w-full"
          onClick={() => onConfirm(candidate.id)}
        >
          {candidate.classification === "similar"
            ? "Choose this alternative"
            : "Use this match"}
        </Button>
      )}
    </Plate>
  );
}
