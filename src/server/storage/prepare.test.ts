// @vitest-environment node
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { UploadRejectedError } from './errors.ts';
import { MAX_IMAGE_SIDE, MAX_UPLOAD_BYTES, prepareUpload } from './prepare.ts';

const background = { r: 200, g: 40, b: 40 };

function canvas(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background } });
}

const pdf = (size: number) => {
  const body = new Uint8Array(size);
  body.set(new TextEncoder().encode('%PDF-1.7\n'));
  return body;
};

async function rejection(file: Blob): Promise<UploadRejectedError> {
  const error = await prepareUpload(file).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(UploadRejectedError);
  return error as UploadRejectedError;
}

describe('size limit', () => {
  it('accepts a file of exactly 4 MB', async () => {
    const prepared = await prepareUpload(new Blob([pdf(MAX_UPLOAD_BYTES)]));
    expect(prepared.contentType).toBe('application/pdf');
    expect(prepared.bytes.byteLength).toBe(MAX_UPLOAD_BYTES);
  });

  it('rejects a file one byte over 4 MB', async () => {
    expect((await rejection(new Blob([pdf(MAX_UPLOAD_BYTES + 1)]))).reason).toBe('too-large');
  });

  it('rejects by the declared size without reading the bytes', async () => {
    const huge = { size: MAX_UPLOAD_BYTES + 1, arrayBuffer: () => Promise.reject(new Error('read')) } as Blob;
    expect((await rejection(huge)).reason).toBe('too-large');
  });

  it('judges size before type, so an oversize non-image is reported as too large', async () => {
    expect((await rejection(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)]))).reason).toBe('too-large');
  });
});

describe('type detection', () => {
  it('turns JPEG, PNG and WebP into WebP', async () => {
    for (const image of [canvas(64, 32).jpeg(), canvas(64, 32).png(), canvas(64, 32).webp()]) {
      const prepared = await prepareUpload(new Blob([await image.toBuffer()]));
      expect(prepared).toMatchObject({ contentType: 'image/webp', extension: 'webp' });
      const info = await sharp(prepared.bytes).metadata();
      expect(info.format).toBe('webp');
      expect([info.width, info.height]).toEqual([64, 32]);
    }
  });

  it('keeps a PDF as it is', async () => {
    const source = pdf(100);
    const prepared = await prepareUpload(new File([source], 'catalog.pdf', { type: 'application/pdf' }));
    expect(prepared).toMatchObject({ contentType: 'application/pdf', extension: 'pdf' });
    expect(new Uint8Array(prepared.bytes)).toEqual(source);
  });

  it('ignores a lying file name and Content-Type', async () => {
    const png = await canvas(8, 8).png().toBuffer();
    const prepared = await prepareUpload(new File([png], 'evil.svg', { type: 'image/svg+xml' }));
    expect(prepared.contentType).toBe('image/webp');

    const text = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'photo.jpg', { type: 'image/jpeg' });
    expect((await rejection(text)).reason).toBe('unsupported-type');
  });

  it('rejects SVG, random bytes and an empty file', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>';
    expect((await rejection(new Blob([svg], { type: 'image/svg+xml' }))).reason).toBe('unsupported-type');
    const random = Uint8Array.from({ length: 512 }, (_, index) => (index * 37 + 11) % 251);
    expect((await rejection(new Blob([random]))).reason).toBe('unsupported-type');
    expect((await rejection(new Blob([]))).reason).toBe('unsupported-type');
  });

  it('rejects an image header with no decodable image behind it', async () => {
    const png = await canvas(32, 32).png().toBuffer();
    const truncated = png.subarray(0, 40);
    expect((await rejection(new Blob([truncated]))).reason).toBe('unreadable-image');
  });

  it('rejects an image with more pixels than the decode limit', async () => {
    // 8000 x 8000 = 64 MP of one colour compresses to a few KB, well under 4 MB.
    const bomb = await sharp({ create: { width: 8000, height: 8000, channels: 3, background } })
      .png()
      .toBuffer();
    expect(bomb.byteLength).toBeLessThan(MAX_UPLOAD_BYTES);
    expect((await rejection(new Blob([bomb]))).reason).toBe('unreadable-image');
  });
});

describe('image re-encoding', () => {
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

    const prepared = await prepareUpload(new Blob([tagged]));
    const info = await sharp(prepared.bytes).metadata();
    expect(info.exif).toBeUndefined();
    expect(info.icc).toBeUndefined();
    expect(prepared.bytes.includes(marker)).toBe(false);
  });

  it('applies the EXIF orientation to the pixels before dropping it', async () => {
    const rotated = await canvas(40, 20).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const prepared = await prepareUpload(new Blob([rotated]));
    const info = await sharp(prepared.bytes).metadata();
    expect([info.width, info.height]).toEqual([20, 40]);
    expect(info.orientation).toBeUndefined();
  });

  it(`shrinks an image to at most ${MAX_IMAGE_SIDE} px on its longest side`, async () => {
    const wide = await canvas(3000, 1500).jpeg().toBuffer();
    const info = await sharp((await prepareUpload(new Blob([wide]))).bytes).metadata();
    expect([info.width, info.height]).toEqual([MAX_IMAGE_SIDE, MAX_IMAGE_SIDE / 2]);
  });

  it('never enlarges a small image', async () => {
    const small = await canvas(100, 50).png().toBuffer();
    const info = await sharp((await prepareUpload(new Blob([small]))).bytes).metadata();
    expect([info.width, info.height]).toEqual([100, 50]);
  });
});
