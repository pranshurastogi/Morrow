import type {
  CaptureInstruction,
  ProductObservation,
} from "../../domain/product-observation";

const REPLACEMENT_CATEGORIES = new Set([
  "replacement_part",
  "printer_cartridge",
  "filter",
  "adapter",
]);

export function determineNextCapture(
  observation: ProductObservation,
): CaptureInstruction | null {
  const identifierTypes = new Set(
    observation.visibleIdentifiers.map((identifier) => identifier.type),
  );
  if (
    REPLACEMENT_CATEGORIES.has(observation.category) &&
    !observation.modelNumber &&
    !observation.partNumber
  ) {
    return {
      captureType: "model_number",
      title: "Show the model number",
      message:
        "Compatibility cannot be verified from shape alone. Show the engraved or printed model number.",
    };
  }
  if (
    !identifierTypes.has("barcode") &&
    !observation.modelNumber &&
    !observation.partNumber
  ) {
    return {
      captureType:
        observation.suggestedNextCapture === "back_label"
          ? "back_label"
          : "barcode",
      title:
        observation.suggestedNextCapture === "back_label"
          ? "Show the back label"
          : "Show the barcode",
      message:
        "The product family is visible, but an identifier is needed to verify the exact item.",
    };
  }
  if (
    !observation.size &&
    ["packaged_product", "skincare", "food", "supplement"].includes(
      observation.category,
    )
  ) {
    return {
      captureType: "back_label",
      title: "Show the size label",
      message:
        "The variant is visible, but the package size still needs verification.",
    };
  }
  return null;
}
