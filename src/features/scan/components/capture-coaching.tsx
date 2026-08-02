import { Barcode, Box, Check, Tags } from "lucide-react";
import { Plate } from "@/components/morrow/bits";
import type { CaptureType } from "../model/capture-guidance";
import {
  captureGuidance,
  FIRST_CAPTURE_SUGGESTIONS,
} from "../model/capture-guidance";

const SUGGESTION_ICONS = {
  shape: Box,
  face: Tags,
  mark: Barcode,
} as const;

export function FirstCaptureSuggestions() {
  return (
    <Plate as="section" className="mt-5 overflow-hidden p-0">
      <div className="border-b border-border px-4 py-3">
        <p className="mono-caps text-brass">What to show</p>
        <p className="mt-1 text-sm text-muted-foreground">
          One photograph can contain all three. Start with the whole object.
        </p>
      </div>
      <ol className="divide-y divide-border">
        {FIRST_CAPTURE_SUGGESTIONS.map((item) => {
          const Icon = SUGGESTION_ICONS[item.id];
          return (
            <li key={item.id} className="grid grid-cols-[2rem_1fr] gap-3 p-3.5">
              <span className="grid h-8 w-8 place-items-center border border-brass/50 text-primary">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.13em] text-brass">
                  {item.index} · {item.label}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Plate>
  );
}

export function CaptureTargetCard({
  captureType,
}: {
  captureType: CaptureType;
}) {
  const guidance = captureGuidance(captureType);
  return (
    <Plate as="section" className="mt-4 p-4">
      <p className="mono-caps text-brass">{guidance.eyebrow}</p>
      <h2 className="mt-1 font-display text-xl">{guidance.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {guidance.instruction}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {guidance.checklist.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-relaxed">
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
              aria-hidden
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Plate>
  );
}
