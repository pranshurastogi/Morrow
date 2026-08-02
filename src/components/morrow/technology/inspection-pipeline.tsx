import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Aperture,
  BadgeCheck,
  Boxes,
  BrainCircuit,
  Camera,
  Fingerprint,
  PackageCheck,
  ReceiptText,
  Search,
} from "lucide-react";
import { Plate, SectionKicker } from "@/components/morrow/bits";
import { cn } from "@/lib/utils";

type PipelineStage = {
  name: string;
  short: string;
  icon: LucideIcon;
  input: string;
  work: string;
  output: string;
  gate: string;
  optimisation: string;
};

const stages: PipelineStage[] = [
  {
    name: "Intake",
    short: "Show",
    icon: Camera,
    input: "Photo + exact/similar intent",
    work: "Presigned upload goes directly to private object storage.",
    output: "Image reference + immutable scan ID",
    gate: "Owner, MIME type and byte limit validated",
    optimisation: "API never proxies the image bytes",
  },
  {
    name: "Prepare",
    short: "Prepare",
    icon: Aperture,
    input: "Original object",
    work: "Rotate, strip metadata, resize and form object, label and OCR views.",
    output: "Bounded views + SHA-256 digest",
    gate: "Blur, brightness and duplicate checks",
    optimisation: "One decode; several purpose-built views",
  },
  {
    name: "Observe",
    short: "Read",
    icon: BrainCircuit,
    input: "Views + untrusted visible text",
    work: "Barcode and OCR run beside a schema-bound multimodal observer.",
    output: "Evidence with source and confidence",
    gate: "Unknown stays null; OCR cannot issue instructions",
    optimisation: "Parallel extraction, hash-keyed reuse",
  },
  {
    name: "Retrieve",
    short: "Find",
    icon: Search,
    input: "Identifiers + normalised attributes",
    work: "Merge exact IDs, full text, vectors, history and live UCP catalogues.",
    output: "Bounded candidate union",
    gate: "Retrieval proposes; it never verifies",
    optimisation: "Fast identifier path before broad recall",
  },
  {
    name: "Verify",
    short: "Prove",
    icon: BadgeCheck,
    input: "Evidence + up to nine finalists",
    work: "Compare catalogue imagery in isolated batches, then apply contradictions.",
    output: "Exact, likely, similar, ambiguous or more evidence",
    gate: "Visual similarity alone cannot create exact",
    optimisation: "Escalate only two close plausible finalists",
  },
  {
    name: "Offer",
    short: "Compare",
    icon: Boxes,
    input: "Chosen canonical identity",
    work: "Refresh source variant, stock, currency, price and anonymous cart.",
    output: "Ranked, source-backed offers",
    gate: "Wrong size, variant or budget is rejected",
    optimisation: "Only relevant storefronts are queried",
  },
  {
    name: "Freeze",
    short: "Bind",
    icon: ReceiptText,
    input: "One product + one offer",
    work: "Snapshot item, merchant, quantity, currency, cap and expiry.",
    output: "Versioned purchase intent",
    gate: "Changed or expired offers require fresh approval",
    optimisation: "Idempotency key per intent version",
  },
  {
    name: "Authorise",
    short: "Approve",
    icon: Fingerprint,
    input: "Frozen purchase intent",
    work: "Prava mounts its secure surface and records passkey approval.",
    output: "One-time merchant- and amount-scoped authority",
    gate: "Card entry never touches Morrow",
    optimisation: "Session is created only when the user is ready",
  },
  {
    name: "Reconcile",
    short: "Confirm",
    icon: PackageCheck,
    input: "Scoped authority + live checkout",
    work: "Restricted worker checks final total, merchant result and Prava state.",
    output: "Verified order or explicit failure",
    gate: "No merchant order ID means no completed order",
    optimisation: "Unknown checkout outcomes are never blind-retried",
  },
];

export function InspectionPipeline() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = stages[activeIndex] ?? stages[0]!;

  return (
    <section id="pipeline" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <SectionKicker index="03">Inspection line</SectionKicker>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <h2 className="max-w-3xl text-balance text-3xl sm:text-4xl">
            Nine stations. Every hand-off leaves a receipt.
          </h2>
          <p className="text-sm text-muted-foreground">
            Select a station to inspect its contract.
          </p>
        </div>

        <div className="tech-pipeline mt-8">
          <ol className="tech-pipeline-rail" aria-label="Inspection stages">
            {stages.map((stage, index) => (
              <li key={stage.name}>
                <button
                  type="button"
                  aria-pressed={index === activeIndex}
                  aria-controls="pipeline-stage-detail"
                  className={cn(
                    "tech-pipeline-button",
                    index === activeIndex && "is-active",
                    index < activeIndex && "is-complete",
                  )}
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="tech-pipeline-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="tech-pipeline-icon">
                    <stage.icon aria-hidden />
                  </span>
                  <span className="tech-pipeline-name">{stage.short}</span>
                </button>
              </li>
            ))}
          </ol>

          <Plate
            id="pipeline-stage-detail"
            className="tech-stage-detail mt-5 overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border bg-secondary/55 px-4 py-3 sm:px-5">
              <div>
                <span className="mono-caps text-brass">
                  Station {String(activeIndex + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-1 text-2xl">{active.name}</h3>
              </div>
              <active.icon className="h-7 w-7 text-primary" aria-hidden />
            </div>
            <div key={active.name} className="tech-stage-ledger animate-slip">
              <div>
                <span>Input</span>
                <strong>{active.input}</strong>
              </div>
              <div>
                <span>Method</span>
                <strong>{active.work}</strong>
              </div>
              <div>
                <span>Output</span>
                <strong>{active.output}</strong>
              </div>
              <div>
                <span>Trust gate</span>
                <strong>{active.gate}</strong>
              </div>
              <div className="tech-stage-optimisation">
                <span>Latency move</span>
                <strong>{active.optimisation}</strong>
              </div>
            </div>
          </Plate>
        </div>
      </div>
    </section>
  );
}
