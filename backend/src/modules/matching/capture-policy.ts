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

const PACKAGED_CATEGORIES = new Set([
  "packaged_product",
  "skincare",
  "beauty",
  "cosmetics",
  "food",
  "supplement",
]);

function instructionForSuggestedCapture(
  captureType: Exclude<
    ProductObservation["suggestedNextCapture"],
    null | "none"
  >,
): CaptureInstruction {
  switch (captureType) {
    case "barcode":
      return {
        captureType,
        title: "Show the barcode",
        message:
          "Keep the complete code straight, sharp, and surrounded by a small clear margin.",
      };
    case "back_label":
      return {
        captureType,
        title: "Show the back label",
        message:
          "Keep the full printed panel square to the camera so its size, variant, and identifiers remain readable.",
      };
    case "model_number":
      return {
        captureType,
        title: "Show the model number",
        message:
          "Include the printed or engraved field name and value with a little surrounding context.",
      };
    case "connector":
      return {
        captureType,
        title: "Show the connector face",
        message:
          "Point the connector toward the camera and keep its surrounding housing visible so orientation can be compared.",
      };
    case "underside":
      return {
        captureType,
        title: "Show the underside",
        message:
          "Include the full underside, especially its plate, ports, feet, and fasteners.",
      };
    case "measurement":
      return {
        captureType,
        title: "Show the object beside a scale",
        message:
          "Place a ruler or known reference in the same plane and keep both endpoints visible.",
      };
    case "full_object":
      return {
        captureType,
        title: "Show another complete angle",
        message:
          "Keep every edge visible and turn a different informative face toward the camera.",
      };
  }
}

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
    if (
      observation.suggestedNextCapture &&
      observation.suggestedNextCapture !== "none"
    ) {
      return instructionForSuggestedCapture(observation.suggestedNextCapture);
    }
    if (PACKAGED_CATEGORIES.has(observation.category)) {
      return instructionForSuggestedCapture("barcode");
    }
    return instructionForSuggestedCapture("full_object");
  }
  if (
    !observation.size &&
    ["packaged_product", "skincare", "food", "supplement"].includes(
      observation.category,
    )
  ) {
    return {
      ...instructionForSuggestedCapture("back_label"),
      title: "Show the size label",
      message:
        "The variant is visible, but the package size still needs verification. Keep the complete size field readable.",
    };
  }
  if (
    !observation.exactIdentificationPossible &&
    observation.suggestedNextCapture &&
    observation.suggestedNextCapture !== "none"
  ) {
    return instructionForSuggestedCapture(observation.suggestedNextCapture);
  }
  return null;
}
