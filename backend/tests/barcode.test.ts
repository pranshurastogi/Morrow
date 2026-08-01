import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { detectBarcode } from "../src/modules/recognition/barcode";

describe("barcode extraction", () => {
  test("returns no result for an image without a barcode", async () => {
    const image = await sharp({
      create: {
        width: 80,
        height: 80,
        channels: 3,
        background: "#f4ecd6",
      },
    })
      .jpeg()
      .toBuffer();

    await expect(detectBarcode(image)).resolves.toEqual([]);
  });
});
