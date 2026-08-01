import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plate, SectionKicker, StatusStamp } from "../bits";

const candidates = [
  {
    name: "Foaming Facial Cleanser",
    detail: "236 ml · Normal to Oily",
    verdict: "Visually similar, wrong size",
    tone: "unverified" as const,
    stamp: "Rejected",
  },
  {
    name: "Hydrating Facial Cleanser",
    detail: "473 ml · Normal to Dry",
    verdict: "Correct brand, wrong variant",
    tone: "similar" as const,
    stamp: "Set aside",
  },
  {
    name: "Foaming Facial Cleanser",
    detail: "473 ml · Normal to Oily",
    verdict: "Barcode, title, size and packaging matched",
    tone: "verified" as const,
    stamp: "Exact",
  },
];

export function SimilarNotEnough() {
  return (
    <section
      id="proof"
      className="border-y border-border bg-card surface-grain"
    >
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="03">Verification</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          Looking similar is not enough.
        </h2>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Near matches are refused. Identifiers, variants and packaging must
          agree.
        </p>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {candidates.map((candidate, index) => (
            <Plate
              as="li"
              key={candidate.name + candidate.detail}
              className="p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-[11px] text-brass">
                  Candidate {String(index + 1).padStart(2, "0")}
                </span>
                <StatusStamp tone={candidate.tone}>
                  {candidate.stamp}
                </StatusStamp>
              </div>
              <h3 className="mt-3 text-lg leading-tight">{candidate.name}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {candidate.detail}
              </p>
              <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
                {candidate.verdict}
              </p>
            </Plate>
          ))}
        </ol>

        <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <StatusStamp tone="verified" animate className="text-sm">
            Exact match verified
          </StatusStamp>
          <Button className="min-h-11" asChild>
            <Link to="/scan">Get this</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
