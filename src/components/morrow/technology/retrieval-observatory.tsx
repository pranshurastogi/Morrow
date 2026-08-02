import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Aperture,
  Barcode,
  Boxes,
  BrainCircuit,
  CircleHelp,
  Database,
  Eye,
  Fingerprint,
  GitMerge,
  History,
  Image,
  OctagonX,
  ScanText,
  Search,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Plate, SectionKicker, StatusStamp } from "@/components/morrow/bits";
import { cn } from "@/lib/utils";

type TraceLane = {
  icon: LucideIcon;
  label: string;
  state: "active" | "weak" | "absent" | "blocked";
  note: string;
};

type RetrievalTrace = {
  id: "package" | "object" | "contradiction";
  tab: string;
  eyebrow: string;
  title: string;
  visibleRead: string;
  query: string;
  lanes: TraceLane[];
  comparison: string;
  policy: string;
  verdict: "exact" | "alternative" | "stopped";
  verdictTitle: string;
  verdictNote: string;
  prava: string;
};

const traces: RetrievalTrace[] = [
  {
    id: "package",
    tab: "Readable package",
    eyebrow: "Trace A · identifier present",
    title: "The label and barcode agree.",
    visibleRead: "Brand · product line · 100 ml · GTIN",
    query: "brand + line + size + exact identifier",
    lanes: [
      { icon: Barcode, label: "Exact ID", state: "active", note: "rank 01" },
      { icon: ScanText, label: "Strict text", state: "active", note: "agrees" },
      { icon: Search, label: "Broad text", state: "active", note: "agrees" },
      {
        icon: BrainCircuit,
        label: "Text vector",
        state: "active",
        note: "agrees",
      },
      { icon: History, label: "Cabinet", state: "absent", note: "new item" },
      {
        icon: ShoppingBag,
        label: "Live UCP",
        state: "active",
        note: "variant",
      },
    ],
    comparison: "Identifier settles identity; imagery checks presentation.",
    policy: "Same GTIN, same size, no fatal contradiction.",
    verdict: "exact",
    verdictTitle: "Exact match",
    verdictNote: "Eligible for current offer checks.",
    prava: "After merchant, amount and expiry are frozen.",
  },
  {
    id: "object",
    tab: "Text-free object",
    eyebrow: "Trace B · no readable identifier",
    title: "Shape starts recall. It does not prove identity.",
    visibleRead: "Object class · silhouette · controls · colour · material",
    query: "wireless mouse · black ergonomic shell · scroll wheel",
    lanes: [
      { icon: Barcode, label: "Exact ID", state: "absent", note: "skip" },
      { icon: ScanText, label: "Strict text", state: "weak", note: "family" },
      { icon: Search, label: "Broad text", state: "active", note: "ranked" },
      {
        icon: BrainCircuit,
        label: "Text vector",
        state: "active",
        note: "ranked",
      },
      { icon: History, label: "Cabinet", state: "absent", note: "empty" },
      {
        icon: ShoppingBag,
        label: "Live UCP",
        state: "active",
        note: "variant",
      },
    ],
    comparison: "Up to nine imaged finalists; three per isolated comparison.",
    policy: "Close source-backed variant, but no exact identifier.",
    verdict: "alternative",
    verdictTitle: "Connected alternative",
    verdictNote: "The customer must choose it explicitly.",
    prava: "Allowed only after that chosen live variant is refreshed.",
  },
  {
    id: "contradiction",
    tab: "Dangerous near-match",
    eyebrow: "Trace C · hard negative",
    title: "The package looks right. The variant is wrong.",
    visibleRead: "Same brand · same colourway · different 50 / 100 ml marker",
    query: "brand + line + visible package presentation",
    lanes: [
      { icon: Barcode, label: "Exact ID", state: "blocked", note: "differs" },
      { icon: ScanText, label: "Strict text", state: "active", note: "close" },
      { icon: Search, label: "Broad text", state: "active", note: "close" },
      {
        icon: BrainCircuit,
        label: "Text vector",
        state: "active",
        note: "close",
      },
      { icon: History, label: "Cabinet", state: "weak", note: "family" },
      {
        icon: ShoppingBag,
        label: "Live UCP",
        state: "active",
        note: "wrong size",
      },
    ],
    comparison: "Visual similarity remains high; contradiction stays visible.",
    policy: "Barcode or exact size mismatch overrides every soft score.",
    verdict: "stopped",
    verdictTitle: "Stopped safely",
    verdictNote: "No offer can inherit the photographed identity.",
    prava: "No payment session may be created.",
  },
];

const engineeringMoves = [
  {
    icon: GitMerge,
    title: "Consensus, not one score",
    note: "Weighted reciprocal-rank fusion combines incomparable retrievers without pretending their scores are probabilities.",
  },
  {
    icon: Eye,
    title: "Unknown earns nothing",
    note: "Unreadable brand, size or variant fields remain unknown; they never become positive visual evidence.",
  },
  {
    icon: Boxes,
    title: "Compute follows doubt",
    note: "Only plausible finalists receive image comparison; only the closest two may receive a precision pass.",
  },
  {
    icon: Fingerprint,
    title: "Money is downstream",
    note: "Prava starts after identity, source variant, stock, currency, budget and user choice have passed policy.",
  },
];

function VerdictIcon({ verdict }: Pick<RetrievalTrace, "verdict">) {
  if (verdict === "exact") return <ShieldCheck aria-hidden />;
  if (verdict === "alternative") return <CircleHelp aria-hidden />;
  return <OctagonX aria-hidden />;
}

export function RetrievalObservatory() {
  const [activeId, setActiveId] = useState<RetrievalTrace["id"]>("object");
  const active = traces.find((trace) => trace.id === activeId) ?? traces[1]!;

  return (
    <section
      id="retrieval"
      className="tech-observatory-section border-b border-border"
    >
      <div className="mx-auto max-w-6xl px-4 py-16">
        <SectionKicker index="04">Retrieval observatory</SectionKicker>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.48fr)] lg:items-end">
          <h2 className="max-w-4xl text-balance text-3xl sm:text-4xl">
            Five views. Six search lanes. One verdict that can be audited.
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground lg:text-right">
            Switch traces to see why “looks similar” is useful for recall, but
            insufficient for authority.
          </p>
        </div>

        <div
          className="tech-trace-switcher mt-7"
          role="group"
          aria-label="Inspection traces"
        >
          {traces.map((trace, index) => (
            <button
              key={trace.id}
              id={`retrieval-tab-${trace.id}`}
              type="button"
              aria-pressed={active.id === trace.id}
              aria-controls="retrieval-trace-panel"
              className={cn(
                "tech-trace-tab",
                active.id === trace.id && "is-active",
              )}
              onClick={() => setActiveId(trace.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {trace.tab}
            </button>
          ))}
        </div>

        <div
          id="retrieval-trace-panel"
          className="mt-3"
          role="region"
          aria-labelledby={`retrieval-tab-${active.id}`}
        >
          <Plate className="overflow-hidden">
            <header className="tech-trace-header">
              <div>
                <span className="mono-caps text-brass">{active.eyebrow}</span>
                <h3 className="mt-1 text-2xl leading-tight">{active.title}</h3>
              </div>
              <StatusStamp
                tone={
                  active.verdict === "exact"
                    ? "verified"
                    : active.verdict === "alternative"
                      ? "similar"
                      : "unverified"
                }
              >
                Illustrative execution trace
              </StatusStamp>
            </header>

            <div key={active.id} className="tech-observatory-rail animate-slip">
              <article className="tech-machine-card tech-capture-machine">
                <div className="tech-machine-label">
                  <span>01</span>
                  <strong>Aligned views</strong>
                  <Aperture aria-hidden />
                </div>
                <div className="tech-capture-frame" aria-hidden>
                  <Image />
                  <span className="tech-crop-corner" data-corner="tl" />
                  <span className="tech-crop-corner" data-corner="tr" />
                  <span className="tech-crop-corner" data-corner="bl" />
                  <span className="tech-crop-corner" data-corner="br" />
                  <span className="tech-crop-line" />
                </div>
                <div className="tech-view-register">
                  {[
                    ["FULL", "context"],
                    ["OBJECT", "shape"],
                    ["LABEL", "marks"],
                    ["OCR", "text"],
                    ["THUMB", "status"],
                  ].map(([view, purpose]) => (
                    <span key={view}>
                      <strong>{view}</strong>
                      <small>{purpose}</small>
                    </span>
                  ))}
                </div>
                <p>{active.visibleRead}</p>
              </article>

              <div className="tech-machine-connector" aria-hidden>
                <span>evidence</span>
              </div>

              <article className="tech-machine-card tech-lane-machine">
                <div className="tech-machine-label">
                  <span>02</span>
                  <strong>Parallel recall</strong>
                  <Database aria-hidden />
                </div>
                <p className="tech-query-slip">QUERY · {active.query}</p>
                <ul className="tech-lane-register">
                  {active.lanes.map((lane) => (
                    <li key={lane.label} data-state={lane.state}>
                      <lane.icon aria-hidden />
                      <span>{lane.label}</span>
                      <small>{lane.note}</small>
                    </li>
                  ))}
                </ul>
              </article>

              <div className="tech-machine-connector" aria-hidden>
                <span>rank lists</span>
              </div>

              <article className="tech-machine-card tech-fusion-machine">
                <div className="tech-machine-label">
                  <span>03</span>
                  <strong>Fuse + compare</strong>
                  <GitMerge aria-hidden />
                </div>
                <div className="tech-fusion-dial" aria-label="Rank fusion">
                  <div>
                    <span>RRF</span>
                    <small>rank agreement</small>
                  </div>
                  {active.lanes.map((lane) => (
                    <i key={lane.label} />
                  ))}
                </div>
                <div
                  className="tech-rerank-batches"
                  aria-label="Visual comparison batches"
                >
                  {[1, 2, 3].map((batch) => (
                    <span key={batch}>
                      <small>B{batch}</small>
                      <i />
                      <i />
                      <i />
                    </span>
                  ))}
                  <strong>TOP 2 · PRECISION ONLY IF CLOSE</strong>
                </div>
                <p>{active.comparison}</p>
              </article>

              <div className="tech-machine-connector" aria-hidden>
                <span>policy</span>
              </div>

              <article
                className="tech-machine-card tech-verdict-machine"
                data-verdict={active.verdict}
              >
                <div className="tech-machine-label">
                  <span>04</span>
                  <strong>Bounded outcome</strong>
                  <VerdictIcon verdict={active.verdict} />
                </div>
                <div className="tech-verdict-seal">
                  <VerdictIcon verdict={active.verdict} />
                  <strong>{active.verdictTitle}</strong>
                  <span>{active.verdictNote}</span>
                </div>
                <dl>
                  <div>
                    <dt>Policy receipt</dt>
                    <dd>{active.policy}</dd>
                  </div>
                  <div>
                    <dt>Prava gate</dt>
                    <dd>{active.prava}</dd>
                  </div>
                </dl>
              </article>
            </div>
          </Plate>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {engineeringMoves.map((move) => (
            <article className="tech-engineering-move" key={move.title}>
              <move.icon aria-hidden />
              <h3>{move.title}</h3>
              <p>{move.note}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
