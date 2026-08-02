import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import {
  derivedObjectKeys,
  prepareImage,
} from "../src/modules/recognition/image-preparation";

describe("aligned image preparation", () => {
  test("creates bounded full, object, label, OCR, and preview views", async () => {
    const source = await sharp({
      create: {
        width: 1_800,
        height: 2_400,
        channels: 3,
        background: "#ede6d5",
      },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="900" height="1300"><rect width="900" height="1300" rx="80" fill="#f9f8f2"/><rect x="110" y="410" width="680" height="350" fill="#315a48"/><text x="155" y="590" font-size="92" fill="white">MORROW</text></svg>',
          ),
          top: 520,
          left: 450,
        },
      ])
      .jpeg()
      .toBuffer();

    const prepared = await prepareImage(source);
    const [processed, objectCrop, labelCrop, ocrReady, thumbnail] =
      await Promise.all([
        sharp(prepared.processed).metadata(),
        sharp(prepared.objectCrop).metadata(),
        sharp(prepared.labelCrop).metadata(),
        sharp(prepared.ocrReady).metadata(),
        sharp(prepared.thumbnail).metadata(),
      ]);

    expect(processed.width).toBeLessThanOrEqual(1_600);
    expect(processed.height).toBeLessThanOrEqual(1_600);
    expect(objectCrop.width).toBe(1_024);
    expect(objectCrop.height).toBe(1_024);
    expect(labelCrop.width).toBe(1_200);
    expect(labelCrop.height).toBe(800);
    expect(ocrReady.format).toBe("png");
    expect(thumbnail.width).toBeLessThanOrEqual(480);
    expect(prepared.objectCropSha256).toHaveLength(64);
    expect(prepared.labelCropSha256).toHaveLength(64);
  });

  test("derives every retained view from one source key", () => {
    expect(derivedObjectKeys("scans/user/photo.jpeg")).toEqual({
      processed: "scans/user/photo.processed.jpg",
      objectCrop: "scans/user/photo.object.jpg",
      labelCrop: "scans/user/photo.label.jpg",
      thumbnail: "scans/user/photo.thumb.webp",
    });
  });
});
