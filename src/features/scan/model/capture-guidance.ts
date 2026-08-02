import type { ScanRecord } from "../api/types";

export type CaptureType = NonNullable<ScanRecord["nextCapture"]>["captureType"];

export type CaptureGuideShape = "object" | "label" | "code" | "detail";

export interface CaptureGuidance {
  captureType: CaptureType;
  eyebrow: string;
  title: string;
  instruction: string;
  guideShape: CaptureGuideShape;
  checklist: readonly string[];
}

const CAPTURE_GUIDANCE: Record<CaptureType, CaptureGuidance> = {
  full_object: {
    captureType: "full_object",
    eyebrow: "Best first view",
    title: "Show the whole object",
    instruction:
      "Use a plain background, face the most informative side toward the lens, and fill about three quarters of the guide.",
    guideShape: "object",
    checklist: [
      "Keep every edge visible",
      "Turn the main label toward the camera",
      "Keep hands away from printed marks",
    ],
  },
  back_label: {
    captureType: "back_label",
    eyebrow: "Printed evidence",
    title: "Show the entire label",
    instruction:
      "Hold the camera parallel to the label so the brand, variant, size, and fine print stay square and readable.",
    guideShape: "label",
    checklist: [
      "Fill the wide guide",
      "Keep all four label edges visible",
      "Tilt the product slightly if light reflects",
    ],
  },
  barcode: {
    captureType: "barcode",
    eyebrow: "Exact identifier",
    title: "Show the barcode straight on",
    instruction:
      "Move close enough to separate every bar, but leave a small clear margin around the complete code.",
    guideShape: "code",
    checklist: [
      "Keep the complete code visible",
      "Hold parallel, not at an angle",
      "Wait for sharp bars before capture",
    ],
  },
  model_number: {
    captureType: "model_number",
    eyebrow: "Exact identifier",
    title: "Show the model or part number",
    instruction:
      "Frame the printed or engraved number with a little surrounding context so Morrow can distinguish the field from nearby text.",
    guideShape: "label",
    checklist: [
      "Include the field name and value",
      "Keep engraved text out of shadow",
      "Use the rear or underside plate when present",
    ],
  },
  connector: {
    captureType: "connector",
    eyebrow: "Compatibility view",
    title: "Show the connector face",
    instruction:
      "Point the connector toward the lens and keep its surrounding housing visible; shape and orientation both matter.",
    guideShape: "detail",
    checklist: [
      "Show the opening straight on",
      "Include the surrounding edge",
      "Avoid fingers covering pins or contacts",
    ],
  },
  underside: {
    captureType: "underside",
    eyebrow: "Second angle",
    title: "Show the underside clearly",
    instruction:
      "Lay the object securely and include its full underside, especially feet, ports, fasteners, and the identification plate.",
    guideShape: "object",
    checklist: [
      "Keep the complete outline visible",
      "Face any plate toward the camera",
      "Use even light across recessed details",
    ],
  },
  measurement: {
    captureType: "measurement",
    eyebrow: "Scale evidence",
    title: "Show the object beside a scale",
    instruction:
      "Place a ruler or known reference in the same plane as the object and keep both endpoints visible.",
    guideShape: "object",
    checklist: [
      "Keep object and scale level",
      "Show the zero point",
      "Avoid perspective from a steep angle",
    ],
  },
};

export const FIRST_CAPTURE_SUGGESTIONS = [
  {
    id: "shape",
    index: "01",
    label: "Whole shape",
    detail: "All edges visible against a quiet background.",
  },
  {
    id: "face",
    index: "02",
    label: "Printed face",
    detail: "Brand, product name, size, or variant turned toward the lens.",
  },
  {
    id: "mark",
    index: "03",
    label: "Exact mark",
    detail: "Barcode, model, or part number when the object has one.",
  },
] as const;

export function captureGuidance(
  captureType: CaptureType = "full_object",
): CaptureGuidance {
  return CAPTURE_GUIDANCE[captureType];
}
