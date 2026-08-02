import {
  ArrowRight,
  Barcode,
  BookOpenCheck,
  Braces,
  CircleHelp,
  Eye,
  History,
  OctagonX,
  ScanSearch,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { Plate, SectionKicker, StatusStamp } from "@/components/morrow/bits";

const evidence = [
  { icon: Barcode, label: "Barcode" },
  { icon: BookOpenCheck, label: "Visible text" },
  { icon: Eye, label: "Image traits" },
  { icon: History, label: "Prior confirmation" },
  { icon: Tags, label: "Catalogue facts" },
];

const contradictions = [
  ["Barcode differs", "Reject"],
  ["Model or part differs", "Reject"],
  ["Exact size differs", "Reject"],
  ["Identifier missing", "Abstain"],
  ["Visual-only agreement", "Likely / alternative"],
];

const computePaths = [
  {
    label: "Known repeat",
    width: "26%",
    note: "hash cache + cabinet history",
  },
  {
    label: "Clear identifier",
    width: "46%",
    note: "exact lookup + contradiction check",
  },
  {
    label: "Uncertain instance",
    width: "82%",
    note: "bounded rerank + one precision pass",
  },
];

export function DecisionEngine() {
  return (
    <section id="verification" className="mx-auto max-w-6xl px-4 py-16">
      <SectionKicker index="04">Decision core</SectionKicker>
      <h2 className="mt-4 max-w-3xl text-balance text-3xl sm:text-4xl">
        Perception supplies evidence. Code decides what it means.
      </h2>

      <div className="tech-decision-map mt-8" aria-label="Decision boundary">
        <Plate className="p-4">
          <span className="mono-caps text-muted-foreground">
            Observed evidence
          </span>
          <ul className="mt-4 grid gap-2">
            {evidence.map((item) => (
              <li
                key={item.label}
                className="flex min-h-10 items-center gap-3 border border-border bg-background px-3 text-sm"
              >
                <item.icon className="h-4 w-4 text-brass" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        </Plate>

        <div className="tech-decision-arrow" aria-hidden>
          <ArrowRight />
          <span>claims</span>
        </div>

        <div className="grid gap-3">
          <Plate className="border-faded-blue/50 p-4">
            <div className="flex items-center gap-3">
              <ScanSearch className="h-5 w-5 text-faded-blue" aria-hidden />
              <h3 className="text-xl">Observer + retriever</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Structured claims, candidates and explicit unknowns.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusStamp tone="info">No commerce tools</StatusStamp>
              <StatusStamp tone="unverified">No purchase authority</StatusStamp>
            </div>
          </Plate>
          <Plate className="border-primary/50 p-4">
            <div className="flex items-center gap-3">
              <Braces className="h-5 w-5 text-primary" aria-hidden />
              <h3 className="text-xl">Deterministic policy</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Normalisation, weights, hard contradictions and candidate margin.
            </p>
          </Plate>
        </div>

        <div className="tech-decision-arrow" aria-hidden>
          <ArrowRight />
          <span>verdict</span>
        </div>

        <Plate className="p-4">
          <span className="mono-caps text-muted-foreground">
            Allowed outcomes
          </span>
          <ul className="mt-4 grid gap-2">
            <li className="tech-verdict is-exact">
              <ShieldCheck aria-hidden />
              <span>
                <strong>Exact</strong>
                <small>identifier + no fatal contradiction</small>
              </span>
            </li>
            <li className="tech-verdict">
              <CircleHelp aria-hidden />
              <span>
                <strong>Likely / similar</strong>
                <small>requires an explicit choice</small>
              </span>
            </li>
            <li className="tech-verdict is-stop">
              <OctagonX aria-hidden />
              <span>
                <strong>Ambiguous / stopped</strong>
                <small>ask for the smallest useful evidence</small>
              </span>
            </li>
          </ul>
        </Plate>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Plate className="overflow-hidden">
          <div className="border-b border-border bg-secondary/55 px-4 py-3">
            <span className="label-caps">Fatal contradiction register</span>
          </div>
          <dl className="divide-y divide-border">
            {contradictions.map(([condition, action]) => (
              <div
                key={condition}
                className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 text-sm"
              >
                <dt className="text-muted-foreground">{condition}</dt>
                <dd className="font-mono text-xs text-foreground">{action}</dd>
              </div>
            ))}
          </dl>
        </Plate>

        <Plate className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="label-caps">Adaptive compute</span>
              <p className="mt-1 text-sm text-muted-foreground">
                More work only when uncertainty can change the decision.
              </p>
            </div>
            <ScanSearch className="h-6 w-6 text-brass" aria-hidden />
          </div>
          <ul className="mt-6 space-y-5">
            {computePaths.map((path) => (
              <li key={path.label}>
                <div className="mb-2 flex items-end justify-between gap-4">
                  <strong className="text-sm font-medium">{path.label}</strong>
                  <span className="text-right font-mono text-[10px] text-muted-foreground">
                    {path.note}
                  </span>
                </div>
                <div className="tech-compute-track">
                  <span style={{ width: path.width }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
            Relative compute, not benchmark latency.
          </p>
        </Plate>
      </div>
    </section>
  );
}
