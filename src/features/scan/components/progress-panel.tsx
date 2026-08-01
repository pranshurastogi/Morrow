import { ProcessingDial } from "@/components/morrow/bits";
import type { ScanStage } from "../model/use-scan-flow";

export function ProgressPanel({
  stage,
}: {
  stage: Extract<ScanStage, "uploading" | "inspecting" | "checkout">;
}) {
  const copy =
    stage === "uploading"
      ? [
          "Preparing the image",
          "Removing private metadata",
          "Opening an inspection",
        ]
      : stage === "checkout"
        ? [
            "Reconciling the live total",
            "Completing merchant checkout",
            "Waiting for final confirmation",
          ]
        : [
            "Reading visible markings",
            "Checking exact identifiers",
            "Comparing catalogue evidence",
          ];
  const label =
    stage === "uploading"
      ? "Preparing the evidence"
      : stage === "checkout"
        ? "Securing the dispatch"
        : "Inspecting the object";
  return (
    <section
      className="receipt-enter py-16"
      aria-live="polite"
      aria-busy="true"
    >
      <ProcessingDial label={label} />
      <ul className="mx-auto mt-8 max-w-xs space-y-1 font-mono text-xs text-muted-foreground">
        {copy.map((item, index) => (
          <li
            key={item}
            className={
              index === copy.length - 1 ? "animate-ticker text-foreground" : ""
            }
          >
            · {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
