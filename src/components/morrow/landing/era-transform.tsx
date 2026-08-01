import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { ArchiveNumber, Plate, SectionKicker } from "../bits";

const eraRows = [
  { old: "Paper catalogue", now: "Phone camera" },
  { old: "Order slip", now: "Verified match" },
  { old: "Cash at the post office", now: "Prava-authorised payment" },
  { old: "Railway route", now: "Delivery timeline" },
];

export function EraTransform() {
  const [value, setValue] = useState(35);
  const modern = value / 100;

  return (
    <section id="era" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <SectionKicker index="01">1900 → tomorrow</SectionKicker>
        <h2 className="mt-4 max-w-2xl text-balance text-3xl sm:text-4xl">
          The desire never changed. The process finally did.
        </h2>
        <p className="mt-3 max-w-prose text-sm text-muted-foreground">
          Drag the brass indicator through a century of checkout.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Plate className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <span
                className="label-caps transition-opacity"
                style={{ opacity: 1 - modern * 0.65 }}
              >
                Mercantile era
              </span>
              <span
                className="label-caps text-primary transition-opacity"
                style={{ opacity: 0.35 + modern * 0.65 }}
              >
                Morrow era
              </span>
            </div>

            <div className="mt-4">
              <Slider
                value={[value]}
                onValueChange={(next) => setValue(next[0] ?? 0)}
                aria-label="Travel from 1900 to Morrow"
                max={100}
                step={1}
              />
              <div className="mt-2 flex justify-between mono-caps text-muted-foreground">
                <span>1900</span>
                <span>1995</span>
                <span>Morrow</span>
              </div>
            </div>

            <ul className="mt-6 divide-y divide-border border-t border-border">
              {eraRows.map((row) => (
                <li
                  key={row.old}
                  className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 py-3"
                >
                  <span
                    className="min-w-0 font-display text-[15px] transition-all"
                    style={{
                      opacity: 1 - modern * 0.75,
                      filter: `saturate(${1 - modern})`,
                    }}
                  >
                    {row.old}
                  </span>
                  <span className="mono-caps text-brass">→</span>
                  <span
                    className="min-w-0 text-right font-mono text-xs transition-all"
                    style={{ opacity: 0.2 + modern * 0.8 }}
                  >
                    {row.now}
                  </span>
                </li>
              ))}
            </ul>
          </Plate>

          <Plate className="flex flex-col justify-between gap-4 p-4">
            <div>
              <span className="label-caps text-muted-foreground">
                Estimated wait
              </span>
              <p className="mt-2 font-display text-5xl leading-none">
                {modern > 0.82
                  ? "1 day"
                  : modern > 0.55
                    ? "4 days"
                    : modern > 0.3
                      ? "2 weeks"
                      : "6–8 weeks"}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {modern > 0.82
                  ? "Object shown once. Exact variant verified. Purchase approved within your limit."
                  : modern > 0.55
                    ? "Twelve keywords, fifteen tabs, and a checkout form that asks where you live for the fourth time."
                    : modern > 0.3
                      ? "Please remain on the line while the clerk searches the entire building."
                      : "Estimated delivery: sometime before the next century."}
              </p>
            </div>
            <div className="border-t border-border pt-3">
              <ArchiveNumber value="LEDGER · MOR-1907-1842" />
            </div>
          </Plate>
        </div>
      </div>
    </section>
  );
}
