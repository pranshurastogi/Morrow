import { z } from "zod";

export const normalizedSizeSchema = z.object({
  value: z.number().positive(),
  unit: z.enum(["ml", "l", "g", "kg", "oz", "fl_oz", "mm", "cm", "m", "in"]),
});

export const visibleIdentifierSchema = z.object({
  type: z.enum([
    "barcode",
    "model_number",
    "part_number",
    "serial_number",
    "sku",
  ]),
  value: z.string().min(1).max(128),
  evidenceBasis: z.enum([
    "directly_visible",
    "ocr",
    "barcode_decoder",
    "probable_inference",
  ]),
});

export const observationClaimSchema = z.object({
  field: z.string().min(1).max(64),
  value: z.string().min(1).max(500),
  evidenceBasis: z.enum([
    "directly_visible",
    "ocr",
    "barcode_decoder",
    "probable_inference",
  ]),
  sourceImageRole: z.enum([
    "primary",
    "label",
    "barcode",
    "object_crop",
    "unknown",
  ]),
});

export const productObservationSchema = z.object({
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).nullable(),
  brand: z.string().max(160).nullable(),
  productName: z.string().max(240).nullable(),
  modelNumber: z.string().max(128).nullable(),
  partNumber: z.string().max(128).nullable(),
  variant: z.string().max(240).nullable(),
  size: normalizedSizeSchema.nullable(),
  colors: z.array(z.string().max(80)).max(12),
  materials: z.array(z.string().max(100)).max(12),
  visibleIdentifiers: z.array(visibleIdentifierSchema).max(20),
  distinctiveFeatures: z.array(z.string().max(240)).max(20),
  visualSearchTerms: z.array(z.string().min(2).max(100)).min(1).max(10),
  claims: z.array(observationClaimSchema).max(40),
  visualFingerprint: z.string().max(1_000),
  exactIdentificationPossible: z.boolean(),
  missingEvidence: z.array(z.string().max(240)).max(12),
  suggestedNextCapture: z
    .enum([
      "barcode",
      "back_label",
      "model_number",
      "connector",
      "underside",
      "full_object",
      "measurement",
      "none",
    ])
    .nullable(),
});

export type ProductObservation = z.infer<typeof productObservationSchema>;
export type NormalizedSize = z.infer<typeof normalizedSizeSchema>;

export const captureInstructionSchema = z.object({
  captureType: z.enum([
    "barcode",
    "back_label",
    "model_number",
    "connector",
    "underside",
    "full_object",
    "measurement",
  ]),
  title: z.string().min(1).max(120),
  message: z.string().min(1).max(320),
});

export type CaptureInstruction = z.infer<typeof captureInstructionSchema>;
