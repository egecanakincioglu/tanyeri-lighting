// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { UploadRejectedError } from './errors.ts';
import { encodeImage, MAX_IMAGE_SIDE } from './prepare.ts';

const background = { r: 200, g: 40, b: 40 };

function canvas(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background } });
}

describe('encodeImage', () => {
  it('turns JPEG, PNG and WebP into WebP', async () => {
    for (const image of [canvas(64, 32).jpeg(), canvas(64, 32).png(), canvas(64, 32).webp()]) {
      const info = await sharp(await encodeImage(await image.toBuffer())).metadata();
      expect(info.format).toBe('webp');
      expect([info.width, info.height]).toEqual([64, 32]);
    }
  });

  it('rejects an image header with no decodable image behind it', async () => {
    const png = await canvas(32, 32).png().toBuffer();
    const error = await encodeImage(png.subarray(0, 40)).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UploadRejectedError);
    expect((error as UploadRejectedError).reason).toBe('unreadable-image');
  });

  it('rejects an image with more pixels than the decode limit', async () => {
    // 8000 x 8000 = 64 MP of one colour compresses to a few KB.
    const bomb = await sharp({ create: { width: 8000, height: 8000, channels: 3, background } })
      .png()
      .toBuffer();
    const error = await encodeImage(bomb).catch((caught: unknown) => caught);
    expect((error as UploadRejectedError).reason).toBe('unreadable-image');
  });

  it('removes EXIF and GPS data', async () => {
    const marker = 'tanyeri-secret-owner';
    const tagged = await canvas(32, 32)
      .jpeg()
      .withExif({
        IFD0: { Copyright: marker },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '41/1 1/1 1/1', GPSLongitudeRef: 'E', GPSLongitude: '29/1 1/1 1/1' },
      })
      .toBuffer();
    expect(tagged.includes(marker)).toBe(true);
    expect((await sharp(tagged).metadata()).exif).toBeDefined();

    const bytes = await encodeImage(tagged);
    const info = await sharp(bytes).metadata();
    expect(info.exif).toBeUndefined();
    expect(info.icc).toBeUndefined();
    expect(bytes.includes(marker)).toBe(false);
  });

  it('applies the EXIF orientation to the pixels before dropping it', async () => {
    const rotated = await canvas(40, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const info = await sharp(await encodeImage(rotated)).metadata();
    expect([info.width, info.height]).toEqual([20, 40]);
    expect(info.orientation).toBeUndefined();
  });

  it(`shrinks an image to at most ${MAX_IMAGE_SIDE} px on its longest side`, async () => {
    const wide = await canvas(3000, 1500).jpeg().toBuffer();
    const info = await sharp(await encodeImage(wide)).metadata();
    expect([info.width, info.height]).toEqual([MAX_IMAGE_SIDE, MAX_IMAGE_SIDE / 2]);
  });

  it('never enlarges a small image', async () => {
    const small = await canvas(100, 50).png().toBuffer();
    const info = await sharp(await encodeImage(small)).metadata();
    expect([info.width, info.height]).toEqual([100, 50]);
  });
});
