import {
  BarcodeFormat,
  BinaryBitmap,
  DataMatrixReader,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatOneDReader,
  QRCodeReader,
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
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.TRY_HARDER, true],
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
      ],
    ],
  ]);
  const readers = [
    new MultiFormatOneDReader(hints),
    new QRCodeReader(),
    new DataMatrixReader(),
  ];

  // MultiFormatReader's CommonJS build does not initialise its default reader
  // collection reliably under Bun. Calling the concrete readers also avoids
  // its noisy exception logging for ordinary images without a barcode.
  for (const reader of readers) {
    try {
      const result = reader.decode(bitmap, hints);
      const normalized = normalizeBarcode(result.getText());
      if (!normalized) continue;
      return [
        {
          format: result.getBarcodeFormat().toString(),
          value: normalized,
          confidence: 1,
        },
      ];
    } catch {
      // A photo without a readable code is a normal extraction result.
    } finally {
      reader.reset();
    }
  }

  return [];
}
