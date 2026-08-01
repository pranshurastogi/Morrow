import {
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from "@zxing/library";
import sharp from "sharp";
import { normalizeBarcode } from "./normalization";

export interface DetectedBarcode {
  format: string;
  value: string;
  confidence: number;
}

export async function detectBarcode(image: Buffer): Promise<DetectedBarcode[]> {
  const { data, info } = await sharp(image)
    .resize({
      width: 1_200,
      height: 1_200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminance = new RGBLuminanceSource(
    new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    info.width,
    info.height,
  );
  const bitmap = new BinaryBitmap(new HybridBinarizer(luminance));
  const reader = new MultiFormatReader();
  try {
    const result = reader.decode(bitmap);
    const normalized = normalizeBarcode(result.getText());
    if (!normalized) return [];
    return [
      {
        format: result.getBarcodeFormat().toString(),
        value: normalized,
        confidence: 1,
      },
    ];
  } catch {
    return [];
  } finally {
    reader.reset();
  }
}
