import sharp from 'sharp';
import { UploadRejectedError } from './errors.ts';
import { detectFileKind } from './file-type.ts';

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Longest side of a stored image. Catalog pictures show at most ~1440 CSS px wide, so 2048 covers a
// full-width view on a 1.4x screen while a typical result stays far below the 1 GB store quota.
export const MAX_IMAGE_SIDE = 2048;
const WEBP_QUALITY = 82;

// A 4 MB PNG can decode to hundreds of megapixels. Refuse to decode more than 50 MP (a 50 MP phone photo fits).
const MAX_INPUT_PIXELS = 50_000_000;

export interface PreparedFile {
  bytes: Buffer;
  contentType: 'image/webp' | 'application/pdf';
  extension: 'webp' | 'pdf';
}

// Order matters: size is checked before a single byte is read, the type before any decoding, and
// only then are images re-encoded. Re-encoding drops all metadata (EXIF, GPS, ICC) because sharp keeps
// none unless asked; rotate() bakes the EXIF orientation into the pixels first so the picture stays upright.
export async function prepareUpload(file: Blob): Promise<PreparedFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadRejectedError('too-large', `File is larger than ${MAX_UPLOAD_BYTES} bytes`);
  }
  const input = new Uint8Array(await file.arrayBuffer());
  const kind = detectFileKind(input);
  if (kind === null) {
    throw new UploadRejectedError('unsupported-type', 'Only JPEG, PNG, WebP and PDF files are accepted');
  }
  if (kind === 'pdf') {
    return { bytes: Buffer.from(input), contentType: 'application/pdf', extension: 'pdf' };
  }
  try {
    const bytes = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    return { bytes, contentType: 'image/webp', extension: 'webp' };
  } catch (error) {
    throw new UploadRejectedError(
      'unreadable-image',
      'The image could not be decoded within the size and pixel limits',
      { cause: error },
    );
  }
}
