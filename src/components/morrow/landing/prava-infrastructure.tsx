import { ArrowRight } from "lucide-react";
import { SectionKicker } from "../bits";

const pipeline = [
  "User intent",
  "Product identification",
  "Exact-match verification",
  "Merchant and offer selection",
  "User-defined spending authority",
  "Prava-secured payment",
  "Verified order result",
];

export function PravaInfrastructure() {
  return (
    <section id="prava" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="05">Behind one tap</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          Simple in front. Strict underneath.
        </h2>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Prava secures each payment within the boundary you approve.
        </p>

        <ol className="mt-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((stage, index) => (
            <li
              key={stage}
              className="flex items-center gap-2 border border-border bg-background px-3 py-3"
            >
              <span className="font-mono text-[11px] text-brass">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 text-sm">{stage}</span>
              {index < pipeline.length - 1 ? (
                <ArrowRight
                  className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              ) : null}
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-prose text-xs text-muted-foreground">
          Uncertain matches are never purchased without confirmation.
        </p>
      </div>
    </section>
  );
}
