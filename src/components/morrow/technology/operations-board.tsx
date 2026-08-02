import {
  Activity,
  ArchiveX,
  DatabaseZap,
  Gauge,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { Plate, SectionKicker, VintageLabel } from "@/components/morrow/bits";

const operatingRules = [
  {
    icon: Network,
    title: "Scale by queue",
    text: "API, recognition, merchant search and checkout scale independently.",
  },
  {
    icon: TimerReset,
    title: "Retry by risk",
    text: "Extraction may retry. An uncertain charge never does.",
  },
  {
    icon: DatabaseZap,
    title: "Ledger every choice",
    text: "Evidence, provenance, policy version and outcome remain auditable.",
  },
  {
    icon: Gauge,
    title: "Bound model spend",
    text: "Reserve atomically, settle from provider tokens, stop at the user cap.",
  },
];

const releaseGates = [
  "Exact precision",
  "Wrong-variant false positives",
  "Recall at ten",
  "Selective coverage",
  "p95 stage latency",
  "Cost per verified order",
];

export function OperationsBoard() {
  return (
    <section id="operations" className="mx-auto max-w-6xl px-4 py-16">
      <SectionKicker index="06">Operating discipline</SectionKicker>
      <h2 className="mt-4 max-w-3xl text-balance text-3xl sm:text-4xl">
        Designed to fail visibly, recover narrowly and scale calmly.
      </h2>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {operatingRules.map((rule) => (
          <Plate as="article" className="p-4" key={rule.title}>
            <rule.icon className="h-5 w-5 text-brass" aria-hidden />
            <h3 className="mt-4 text-xl leading-tight">{rule.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {rule.text}
            </p>
          </Plate>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.16fr)_minmax(330px,0.84fr)]">
        <Plate className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-secondary/55 px-4 py-3">
            <span className="label-caps">Credential boundary</span>
            <LockKeyhole className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <div className="tech-security-zones">
            <section>
              <span className="mono-caps text-faded-blue">Browser may see</span>
              <ul>
                <li>Scan and evidence</li>
                <li>Verified offers</li>
                <li>Prava secure frame</li>
                <li>Order status</li>
              </ul>
            </section>
            <section>
              <span className="mono-caps text-brass">Worker only</span>
              <ul>
                <li>Encrypted delivery data</li>
                <li>Scoped credential in memory</li>
                <li>Final-total reconciliation</li>
                <li>Merchant executor secret</li>
              </ul>
            </section>
            <section>
              <span className="mono-caps text-postal">
                Never reaches browser or logs
              </span>
              <ul>
                <li>Prava secret key</li>
                <li>One-time card token</li>
                <li>Dynamic security code</li>
                <li>Raw card number</li>
              </ul>
            </section>
          </div>
          <div className="grid gap-px border-t border-border bg-border sm:grid-cols-3">
            <div className="bg-background p-3 text-center">
              <KeyRound className="mx-auto h-4 w-4 text-primary" aria-hidden />
              <span className="mt-2 block font-mono text-[10px]">
                ITEM-SCOPED
              </span>
            </div>
            <div className="bg-background p-3 text-center">
              <Gauge className="mx-auto h-4 w-4 text-primary" aria-hidden />
              <span className="mt-2 block font-mono text-[10px]">
                AMOUNT-SCOPED
              </span>
            </div>
            <div className="bg-background p-3 text-center">
              <ArchiveX className="mx-auto h-4 w-4 text-primary" aria-hidden />
              <span className="mt-2 block font-mono text-[10px]">
                SHORT-LIVED
              </span>
            </div>
          </div>
        </Plate>

        <Plate className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="label-caps">Release instrument panel</span>
              <p className="mt-2 text-sm text-muted-foreground">
                Thresholds freeze before the held-out test run.
              </p>
            </div>
            <Activity className="h-5 w-5 text-brass" aria-hidden />
          </div>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {releaseGates.map((gate, index) => (
              <li
                key={gate}
                className="flex min-h-10 items-center justify-between gap-3 border-b border-border py-2"
              >
                <span className="text-sm">{gate}</span>
                <VintageLabel>
                  {index === 1 ? "MINIMISE" : index > 3 ? "BOUND" : "MEASURE"}
                </VintageLabel>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-3 border border-primary/35 bg-primary/5 p-3">
            <ShieldCheck
              className="h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <p className="text-sm">
              North star: verified correct orders / completed orders.
            </p>
          </div>
        </Plate>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="tech-retention-rule">
          <span>24 h</span>
          <strong>Original upload</strong>
        </div>
        <div className="tech-retention-rule">
          <span>7 d</span>
          <strong>Processed views</strong>
        </div>
        <div className="tech-retention-rule">
          <span>0 d</span>
          <strong>Payment credential storage</strong>
        </div>
      </div>
    </section>
  );
}
