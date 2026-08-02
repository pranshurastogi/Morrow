import { useEffect, useMemo, useState } from "react";
import {
  Aperture,
  BookOpenCheck,
  Camera,
  CircleCheck,
  PackageSearch,
  ScanSearch,
  ShieldCheck,
  Store,
} from "lucide-react";
import type { ScanRecord } from "../api/types";
import {
  INSPECTION_STEPS,
  inspectionFacts,
  inspectionNarrative,
  inspectionStepIndex,
  observedProductLabel,
  type InspectionStoryIcon,
} from "../model/inspection-story";
import type { ScanStage } from "../model/use-scan-flow";

type ActiveStage = Extract<ScanStage, "uploading" | "inspecting" | "checkout">;

const STORY_ICONS = {
  camera: Camera,
  evidence: ScanSearch,
  catalogue: BookOpenCheck,
  identity: ShieldCheck,
  dispatch: Store,
  checkout: PackageSearch,
} satisfies Record<InspectionStoryIcon, typeof Camera>;

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function ProgressPanel({
  stage,
  scan,
}: {
  stage: ActiveStage;
  scan: ScanRecord | null;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const narrative = inspectionNarrative(stage, scan);
  const facts = useMemo(() => inspectionFacts(stage), [stage]);
  const activeStep = inspectionStepIndex(stage, scan?.status);
  const productLabel = observedProductLabel(scan);
  const StoryIcon = STORY_ICONS[narrative.icon];

  useEffect(() => {
    setElapsedSeconds(0);
    const timer = window.setInterval(
      () => setElapsedSeconds((value) => value + 1),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    setFactIndex(0);
    const timer = window.setInterval(
      () => setFactIndex((value) => (value + 1) % facts.length),
      4_800,
    );
    return () => window.clearInterval(timer);
  }, [facts]);

  return (
    <section
      className="inspection-story receipt-enter"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`${narrative.title}. ${narrative.detail}`}
    >
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <p className="mono-caps text-primary">Live inspection</p>
        <p
          className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground"
          aria-hidden="true"
        >
          {formatElapsed(elapsedSeconds)}
        </p>
      </header>

      <div className="inspection-machine" data-phase={narrative.icon}>
        <div className="inspection-aperture" aria-hidden="true">
          <Aperture className="inspection-aperture-ring" />
          <span className="inspection-object-mark">
            <StoryIcon />
          </span>
          <span className="inspection-sweep" />
        </div>
        <div
          className="inspection-story-copy"
          key={`${stage}:${scan?.status ?? "pending"}`}
        >
          <p className="mono-caps text-brass">{narrative.eyebrow}</p>
          <h2 className="mt-2 font-display text-[1.85rem] leading-[1.04] text-foreground">
            {narrative.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {narrative.detail}
          </p>
          {productLabel ? (
            <p className="inspection-finding mt-4 font-mono text-xs leading-relaxed text-primary">
              <CircleCheck aria-hidden="true" />
              <span>{productLabel}</span>
            </p>
          ) : null}
        </div>
      </div>

      <ol className="inspection-track" aria-label="Inspection progress">
        {INSPECTION_STEPS.map((step, index) => {
          const complete = index < activeStep;
          const current = index === activeStep;
          return (
            <li
              key={step.label}
              className="inspection-track-step"
              data-state={
                complete ? "complete" : current ? "current" : "waiting"
              }
              aria-current={current ? "step" : undefined}
            >
              <span className="inspection-track-mark" aria-hidden="true">
                {complete ? <CircleCheck /> : <span>{index + 1}</span>}
              </span>
              <span>{step.label}</span>
            </li>
          );
        })}
      </ol>

      <aside
        className="inspection-fact"
        aria-label="How this inspection works"
        aria-live="off"
      >
        <BookOpenCheck aria-hidden="true" />
        <div key={`${stage}:${factIndex}`} className="inspection-fact-slip">
          <p className="mono-caps text-brass">From the field manual</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            {facts[factIndex]}
          </p>
        </div>
      </aside>
    </section>
  );
}
