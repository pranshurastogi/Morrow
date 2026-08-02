import type { ScanRecord, ScanStatus } from "../api/types";
import type { ScanStage } from "./use-scan-flow";

export type InspectionStoryIcon =
  "camera" | "evidence" | "catalogue" | "identity" | "dispatch" | "checkout";

export interface InspectionNarrative {
  eyebrow: string;
  title: string;
  detail: string;
  icon: InspectionStoryIcon;
}

export const INSPECTION_STEPS = [
  { label: "Photograph", icon: "camera" },
  { label: "Evidence", icon: "evidence" },
  { label: "Catalogue", icon: "catalogue" },
  { label: "Identity", icon: "identity" },
  { label: "Dispatch", icon: "dispatch" },
] as const;

const STATUS_INDEX: Partial<Record<ScanStatus, number>> = {
  CREATED: 0,
  IMAGE_UPLOADED: 0,
  PREPROCESSING: 1,
  EVIDENCE_EXTRACTED: 2,
  CANDIDATES_RETRIEVED: 2,
  VERIFYING: 3,
  EXACT_VERIFIED: 3,
  SEARCHING_MERCHANTS: 4,
  OFFERS_READY: 4,
};

const STATUS_NARRATIVE: Partial<Record<ScanStatus, InspectionNarrative>> = {
  CREATED: {
    eyebrow: "Intake 01",
    title: "Opening an inspection",
    detail: "The photograph is entering the object desk.",
    icon: "camera",
  },
  IMAGE_UPLOADED: {
    eyebrow: "Intake 01",
    title: "Photograph received",
    detail: "A private working copy is ready for inspection.",
    icon: "camera",
  },
  PREPROCESSING: {
    eyebrow: "Evidence 02",
    title: "Reading the visible clues",
    detail:
      "Orientation, image quality, codes and printed marks are checked together.",
    icon: "evidence",
  },
  EVIDENCE_EXTRACTED: {
    eyebrow: "Catalogue 03",
    title: "Opening the catalogues",
    detail:
      "Observed names, sizes and identifiers are being retrieved across live and indexed records.",
    icon: "catalogue",
  },
  CANDIDATES_RETRIEVED: {
    eyebrow: "Catalogue 03",
    title: "Candidates are on the desk",
    detail: "The strongest records are being arranged for an exact comparison.",
    icon: "catalogue",
  },
  VERIFYING: {
    eyebrow: "Identity 04",
    title: "Testing exact identity",
    detail:
      "Size, variant, markings and packaging must agree before Morrow proceeds.",
    icon: "identity",
  },
  EXACT_VERIFIED: {
    eyebrow: "Identity 04",
    title: "Identity settled",
    detail:
      "The exact record passed its evidence checks. Live dispatches are next.",
    icon: "identity",
  },
  SEARCHING_MERCHANTS: {
    eyebrow: "Dispatch 05",
    title: "Opening live merchant ledgers",
    detail:
      "Orderable variants are being checked for identity, stock, currency and budget.",
    icon: "dispatch",
  },
};

const INSPECTION_FACTS = [
  "A barcode or model number outranks visual resemblance when one is visible.",
  "Printed text is treated as evidence, never as an instruction.",
  "A close look-alike is stopped when its size, model or variant disagrees.",
  "Shopify's global catalogue and the most relevant live storefronts are searched together.",
  "Only a sellable variant that passes deterministic checks can reach approval.",
  "Product interpretation stays separate from payment authority.",
] as const;

const UPLOAD_FACTS = [
  "The original photograph is re-encoded without private camera metadata.",
  "Large photographs are reduced to a bounded working copy before inspection.",
  "The original and working image follow separate retention windows.",
] as const;

const CHECKOUT_FACTS = [
  "Prava approval is bound to one merchant, item, amount and short time window.",
  "The card surface stays with Prava; Morrow never renders raw card details.",
  "A payment credential is not an order—merchant confirmation still has to arrive.",
] as const;

export function inspectionStepIndex(
  stage: Extract<ScanStage, "uploading" | "inspecting" | "checkout">,
  status?: ScanStatus,
): number {
  if (stage === "checkout") return 4;
  if (stage === "uploading") return 0;
  return status ? (STATUS_INDEX[status] ?? 1) : 1;
}

export function inspectionNarrative(
  stage: Extract<ScanStage, "uploading" | "inspecting" | "checkout">,
  scan: ScanRecord | null,
): InspectionNarrative {
  if (stage === "uploading") {
    return {
      eyebrow: "Intake 01",
      title: "Preparing the photograph",
      detail: "A clean working copy is being placed on the object desk.",
      icon: "camera",
    };
  }
  if (stage === "checkout") {
    return {
      eyebrow: "Secure dispatch",
      title: "Closing the purchase loop",
      detail:
        "The live total, merchant result and Prava status are being reconciled.",
      icon: "checkout",
    };
  }
  return (
    (scan ? STATUS_NARRATIVE[scan.status] : null) ?? {
      eyebrow: "Evidence 02",
      title: "Inspecting the object",
      detail:
        "Visible clues are being arranged into a verifiable product record.",
      icon: "evidence",
    }
  );
}

export function inspectionFacts(
  stage: Extract<ScanStage, "uploading" | "inspecting" | "checkout">,
): readonly string[] {
  if (stage === "uploading") return UPLOAD_FACTS;
  if (stage === "checkout") return CHECKOUT_FACTS;
  return INSPECTION_FACTS;
}

export function observedProductLabel(scan: ScanRecord | null): string | null {
  if (!scan?.observation) return null;
  const size = scan.observation.size
    ? `${scan.observation.size.value} ${scan.observation.size.unit.replace("_", " ")}`
    : null;
  const label = [
    scan.observation.brand,
    scan.observation.productName,
    scan.observation.variant,
    size,
  ]
    .filter(Boolean)
    .join(" · ");
  return label || null;
}
