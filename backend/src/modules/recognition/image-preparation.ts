import { createHash } from "node:crypto";
import sharp from "sharp";

export interface PreparedImage {
  processed: Buffer;
  objectCrop: Buffer;
  labelCrop: Buffer;
  ocrReady: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  blurScore: number;
  brightnessScore: number;
  sha256: string;
  objectCropSha256: string;
  labelCropSha256: string;
}

export async function prepareImage(input: Buffer): Promise<PreparedImage> {
  const sha256 = createHash("sha256").update(input).digest("hex");
  const processed = await sharp(input, {
    failOn: "warning",
    limitInputPixels: 80_000_000,
  })
    .rotate()
    .resize({
      width: 1_600,
      height: 1_600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .flatten({ background: "#f4ecd6" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  // Retrieval photographs and catalogue plates rarely share the same framing.
  // Keep a full view for context, then derive bounded views that make the
  // salient object and its printed label occupy comparable pixel area. Sharp's
  // attention/entropy strategies are deterministic and add no network model to
  // the latency-critical path.
  const [objectCrop, labelCrop, ocrReady, thumbnail] = await Promise.all([
    sharp(processed)
      .resize({
        width: 1_024,
        height: 1_024,
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .sharpen({ sigma: 0.65 })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer(),
    sharp(processed)
      .resize({
        width: 1_200,
        height: 800,
        fit: "cover",
        position: sharp.strategy.entropy,
      })
      .sharpen({ sigma: 0.8 })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer(),
    sharp(processed)
      .grayscale()
      .normalize()
      .sharpen({ sigma: 0.9 })
      .png({ compressionLevel: 9 })
      .toBuffer(),
    sharp(processed)
      .resize({
        width: 480,
        height: 480,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toBuffer(),
  ]);
  const [metadata, stats] = await Promise.all([
    sharp(processed).metadata(),
    sharp(processed).stats(),
  ]);
  const brightnessScore =
    stats.channels
      .slice(0, 3)
      .reduce((sum, channel) => sum + channel.mean / 255, 0) / 3;

  return {
    processed,
    objectCrop,
    labelCrop,
    ocrReady,
    thumbnail,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    blurScore: Math.min(1, stats.sharpness / 12),
    brightnessScore,
    sha256,
    objectCropSha256: createHash("sha256").update(objectCrop).digest("hex"),
    labelCropSha256: createHash("sha256").update(labelCrop).digest("hex"),
  };
}

export function derivedObjectKeys(sourceKey: string): {
  processed: string;
  objectCrop: string;
  labelCrop: string;
  thumbnail: string;
} {
  const withoutExtension = sourceKey.replace(/\.[^/.]+$/, "");
  return {
    processed: `${withoutExtension}.processed.jpg`,
    objectCrop: `${withoutExtension}.object.jpg`,
    labelCrop: `${withoutExtension}.label.jpg`,
    thumbnail: `${withoutExtension}.thumb.webp`,
  };
}
