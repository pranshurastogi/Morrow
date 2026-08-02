import type { CaptureType } from "./capture-guidance";

export interface FrameMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  detailRatio: number;
  motion: number;
  centerOffset: number;
}

export interface FrameSample {
  metrics: FrameMetrics;
  luma: Uint8Array;
}

export type FrameCheckState = "good" | "adjust";

export interface FrameQualityCheck {
  id: "light" | "detail" | "alignment";
  label: string;
  state: FrameCheckState;
}

export interface FrameAssessment {
  ready: boolean;
  advice: string;
  checks: readonly FrameQualityCheck[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function analyzeFramePixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  previousLuma?: Uint8Array | null,
): FrameSample {
  const pixelCount = width * height;
  if (width < 2 || height < 2 || rgba.length < pixelCount * 4) {
    throw new Error("Frame sample dimensions are invalid");
  }

  const luma = new Uint8Array(pixelCount);
  let sum = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const value = Math.round(
      rgba[offset]! * 0.2126 +
        rgba[offset + 1]! * 0.7152 +
        rgba[offset + 2]! * 0.0722,
    );
    luma[index] = value;
    sum += value;
  }

  const mean = sum / pixelCount;
  let varianceSum = 0;
  let gradientSum = 0;
  let detailedPixels = 0;
  let energySum = 0;
  let energyX = 0;
  let energyY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = luma[index]!;
      varianceSum += (value - mean) ** 2;
      if (x === width - 1 || y === height - 1) continue;
      const gradient =
        Math.abs(value - luma[index + 1]!) +
        Math.abs(value - luma[index + width]!);
      gradientSum += gradient;
      if (gradient > 34) detailedPixels += 1;
      energySum += gradient;
      energyX += gradient * (x / (width - 1));
      energyY += gradient * (y / (height - 1));
    }
  }

  let motion = 0;
  if (previousLuma?.length === luma.length) {
    let motionSum = 0;
    for (let index = 0; index < luma.length; index += 1) {
      motionSum += Math.abs(luma[index]! - previousLuma[index]!);
    }
    motion = motionSum / pixelCount / 255;
  }

  const comparedPixels = (width - 1) * (height - 1);
  const centroidX = energySum > 0 ? energyX / energySum : 0.5;
  const centroidY = energySum > 0 ? energyY / energySum : 0.5;
  const centerOffset =
    Math.hypot(centroidX - 0.5, centroidY - 0.5) / Math.SQRT1_2;

  return {
    luma,
    metrics: {
      brightness: clamp01(mean / 255),
      contrast: clamp01(Math.sqrt(varianceSum / pixelCount) / 96),
      sharpness: clamp01(gradientSum / comparedPixels / 80),
      detailRatio: clamp01(detailedPixels / comparedPixels),
      motion: clamp01(motion),
      centerOffset: clamp01(centerOffset),
    },
  };
}

export function assessFrameQuality(
  metrics: FrameMetrics,
  captureType: CaptureType,
): FrameAssessment {
  const precisionView = ["barcode", "back_label", "model_number"].includes(
    captureType,
  );
  const lightGood = metrics.brightness >= 0.17 && metrics.brightness <= 0.9;
  const detailGood =
    metrics.sharpness >= (precisionView ? 0.12 : 0.085) &&
    metrics.detailRatio >= (precisionView ? 0.075 : 0.045) &&
    metrics.motion <= 0.16;
  const alignmentGood = metrics.centerOffset <= 0.38;

  const checks: FrameQualityCheck[] = [
    { id: "light", label: "Light", state: lightGood ? "good" : "adjust" },
    {
      id: "detail",
      label: precisionView ? "Text detail" : "Object detail",
      state: detailGood ? "good" : "adjust",
    },
    {
      id: "alignment",
      label: "Centring",
      state: alignmentGood ? "good" : "adjust",
    },
  ];

  let advice = "Frame looks useful — hold this position for capture.";
  if (metrics.brightness < 0.17) {
    advice = "Add light or move out of shadow.";
  } else if (metrics.brightness > 0.9) {
    advice = "Reduce glare or tilt the object away from the light.";
  } else if (metrics.motion > 0.16) {
    advice = "Hold steady for a moment before capture.";
  } else if (!detailGood) {
    advice = precisionView
      ? "Move closer until the printed marks look crisp."
      : "Move a little closer and let the object fill the guide.";
  } else if (!alignmentGood) {
    advice = "Centre the useful detail inside the brass corners.";
  }

  return {
    ready: checks.every((check) => check.state === "good"),
    advice,
    checks,
  };
}
