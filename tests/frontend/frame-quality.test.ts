import { describe, expect, test } from "bun:test";
import { captureGuidance } from "../../src/features/scan/model/capture-guidance";
import {
  analyzeFramePixels,
  assessFrameQuality,
} from "../../src/features/scan/model/frame-quality";

function rgbaFrame(
  width: number,
  height: number,
  pixel: (x: number, y: number) => number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = pixel(x, y);
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return data;
}

describe("capture guidance", () => {
  test("uses a narrow guide and precision instructions for barcodes", () => {
    const guidance = captureGuidance("barcode");
    expect(guidance.guideShape).toBe("code");
    expect(guidance.instruction).toContain("complete code");
  });

  test("marks a detailed, centred frame as useful", () => {
    const width = 24;
    const height = 18;
    const pixels = rgbaFrame(width, height, (x, y) =>
      (x + y) % 2 === 0 ? 45 : 215,
    );
    const sample = analyzeFramePixels(pixels, width, height);
    const assessment = assessFrameQuality(sample.metrics, "full_object");
    expect(assessment.ready).toBeTrue();
    expect(
      assessment.checks.every((check) => check.state === "good"),
    ).toBeTrue();
  });

  test("asks for more light before judging other frame details", () => {
    const pixels = rgbaFrame(16, 12, () => 12);
    const sample = analyzeFramePixels(pixels, 16, 12);
    const assessment = assessFrameQuality(sample.metrics, "back_label");
    expect(assessment.ready).toBeFalse();
    expect(assessment.advice).toContain("Add light");
    expect(assessment.checks[0]?.state).toBe("adjust");
  });

  test("detects substantial movement between samples", () => {
    const first = analyzeFramePixels(
      rgbaFrame(16, 12, (x) => (x < 8 ? 30 : 220)),
      16,
      12,
    );
    const second = analyzeFramePixels(
      rgbaFrame(16, 12, (x) => (x < 8 ? 220 : 30)),
      16,
      12,
      first.luma,
    );
    expect(second.metrics.motion).toBeGreaterThan(0.5);
    expect(assessFrameQuality(second.metrics, "full_object").advice).toContain(
      "Hold steady",
    );
  });
});
