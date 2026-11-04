// Shared by the panel's file field (browser) and the server steps behind it, so both sides state the same limits.
export type MediaKind = 'image' | 'file';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

// Files go from the browser to this folder of the store first; the server then checks them and moves them on.
export const TMP_PREFIX = 'tmp/';

export function maxBytesOf(kind: MediaKind): number {
  return kind === 'image' ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;
}
