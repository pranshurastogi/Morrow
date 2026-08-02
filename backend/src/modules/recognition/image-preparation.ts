import { createHash } from "node:crypto";
import sharp from "sharp";

export interface PreparedImage {
  processed: Buffer;
  thumbnail: Buffer;
  width: number;
  height: number;
  blurScore: number;
  brightnessScore: number;
  sha256: string;
}

export async function prepareImage(input: Buffer): Promise<PreparedImage> {
  const sha256 = createHash("sha256").update(input).digest("hex");
  const pipeline = sharp(input, {
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
    .removeAlpha();

  const [processed, thumbnail] = await Promise.all([
    pipeline.clone().jpeg({ quality: 84, mozjpeg: true }).toBuffer(),
    pipeline
      .clone()
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
    thumbnail,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    blurScore: Math.min(1, stats.sharpness / 12),
    brightnessScore,
    sha256,
  };
}

export function derivedObjectKeys(sourceKey: string): {
  processed: string;
  thumbnail: string;
} {
  const withoutExtension = sourceKey.replace(/\.[^/.]+$/, "");
  return {
    processed: `${withoutExtension}.processed.jpg`,
    thumbnail: `${withoutExtension}.thumb.webp`,
  };
}
