import {
  ArrowRight,
  Check,
  CircleDot,
  CornerDownLeft,
  Fingerprint,
  PackageCheck,
  SearchCheck,
  ShieldAlert,
} from "lucide-react";
import { Plate, SectionKicker } from "@/components/morrow/bits";

const groups = [
  {
    index: "A",
    title: "Evidence",
    icon: CircleDot,
    states: ["IMAGE UPLOADED", "PREPROCESSING", "EVIDENCE EXTRACTED"],
  },
  {
    index: "B",
    title: "Identity",
    icon: SearchCheck,
    states: ["CANDIDATES RETRIEVED", "VERIFYING", "EXACT / SIMILAR"],
  },
  {
    index: "C",
    title: "Commerce",
    icon: PackageCheck,
    states: ["SEARCHING MERCHANTS", "OFFERS READY", "AWAITING APPROVAL"],
  },
  {
    index: "D",
    title: "Authority",
    icon: Fingerprint,
    states: ["SESSION CREATED", "CHECKOUT IN PROGRESS", "ORDER / FAILURE"],
  },
];

export function DurableWorkflow() {
  return (
    <section id="state" className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <SectionKicker index="06">Durable workflow</SectionKicker>
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <h2 className="max-w-3xl text-balance text-3xl sm:text-4xl">
            The request survives refreshes, retries and restarts.
          </h2>
          <p className="max-w-sm text-sm text-muted-foreground lg:text-right">
            HTTP starts work. The ledger owns progress.
          </p>
        </div>

        <ol
          className="tech-state-groups mt-8"
          aria-label="Durable scan state machine"
        >
          {groups.map((group, groupIndex) => (
            <li className="contents" key={group.title}>
              <Plate as="article" className="tech-state-group p-4">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-brass">
                      {group.index}
                    </span>
                    <h3 className="text-xl">{group.title}</h3>
                  </span>
                  <group.icon className="h-5 w-5 text-primary" aria-hidden />
                </div>
                <ol className="mt-3 space-y-1.5">
                  {group.states.map((state, stateIndex) => (
                    <li
                      key={state}
                      className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-2 font-mono text-[10px] tracking-[0.08em]"
                    >
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-primary">
                        {stateIndex === group.states.length - 1 ? (
                          <Check className="h-3 w-3" aria-hidden />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-brass" />
                        )}
                      </span>
                      {state}
                    </li>
                  ))}
                </ol>
              </Plate>
              {groupIndex < groups.length - 1 ? (
                <ArrowRight className="tech-state-arrow" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="tech-state-note">
            <CornerDownLeft aria-hidden />
            <span>
              <strong>Insufficient evidence</strong>
              asks for one useful view, then resumes the same scan.
            </span>
          </div>
          <div className="tech-state-note">
            <ShieldAlert aria-hidden />
            <span>
              <strong>Uncertain checkout</strong>
              stops for reconciliation; it is never automatically retried.
            </span>
          </div>
          <div className="tech-state-note">
            <Check aria-hidden />
            <span>
              <strong>Version check</strong>
              rejects stale jobs before they overwrite newer evidence.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
