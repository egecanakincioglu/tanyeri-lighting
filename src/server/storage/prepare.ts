import sharp from 'sharp';
import { UploadRejectedError } from './errors.ts';

// Longest side of a stored image. Catalog pictures show at most ~1440 CSS px wide, so 2048 covers a
// full-width view on a 1.4x screen while a typical result stays far below the 1 GB store quota.
export const MAX_IMAGE_SIDE = 2048;
const WEBP_QUALITY = 82;

// A 20 MB PNG can decode to hundreds of megapixels. Refuse to decode more than 50 MP (a 50 MP phone photo fits).
const MAX_INPUT_PIXELS = 50_000_000;

// Re-encoding drops all metadata (EXIF, GPS, ICC) because sharp keeps none unless asked; rotate() bakes the EXIF
// orientation into the pixels first so the picture stays upright. The caller has already checked size and type.
export async function encodeImage(input: Uint8Array): Promise<Buffer> {
  try {
    return await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (error) {
    throw new UploadRejectedError(
      'unreadable-image',
      'The image could not be decoded within the size and pixel limits',
      { cause: error },
    );
  }
}
