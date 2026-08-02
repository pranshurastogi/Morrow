import { Eye, Search } from "lucide-react";
import { Plate, StatusStamp } from "@/components/morrow/bits";
import type { ScanRecord } from "../api/types";

function unique(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(values.map((value) => value?.trim()).filter(Boolean)),
  ] as string[];
}

export function ObservationSummary({ scan }: { scan: ScanRecord }) {
  const observation = scan.observation;
  if (!observation) return null;
  const objectName =
    observation.productName ??
    observation.subcategory ??
    observation.category ??
    "Object family";
  const visibleClues = unique([
    ...(observation.distinctiveFeatures ?? []),
    ...(observation.colors ?? []).map((color) => `${color} colour`),
    ...(observation.materials ?? []),
  ]).slice(0, 4);
  const searchTerms = unique(observation.visualSearchTerms ?? []).slice(0, 3);
  const stillNeeded = unique(observation.missingEvidence ?? []).slice(0, 3);

  return (
    <Plate as="section" className="mt-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <Eye className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="label-caps text-muted-foreground">
              What Morrow can tell
            </p>
            <h2 className="mt-1 font-display text-xl leading-tight">
              {objectName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {observation.brand
                ? `Maker observed: ${observation.brand}`
                : "Maker and exact model are not visible yet."}
            </p>
          </div>
        </div>
        <StatusStamp tone="unverified" className="text-center">
          Family read
        </StatusStamp>
      </div>

      {(visibleClues.length > 0 || searchTerms.length > 0) && (
        <div className="mt-4 border-y border-border py-3">
          {visibleClues.length > 0 && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Visible:</span>{" "}
              {visibleClues.join(" · ")}
            </p>
          )}
          {searchTerms.length > 0 && (
            <p className="mt-2 flex gap-2 text-sm leading-relaxed text-muted-foreground">
              <Search
                className="mt-0.5 h-4 w-4 shrink-0 text-brass"
                aria-hidden
              />
              <span>
                <span className="font-medium text-foreground">
                  Catalogue search:
                </span>{" "}
                {searchTerms.join(" · ")}
              </span>
            </p>
          )}
        </div>
      )}

      {stillNeeded.length > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          For an exact purchase: {stillNeeded.join(" · ")}.
        </p>
      )}
    </Plate>
  );
}
