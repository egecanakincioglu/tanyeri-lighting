// Shared by the browser file field and the server steps.
export type MediaKind = 'image' | 'file';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_BYTES = 50 * 1024 * 1024;

// Files go to this folder first; the server checks and moves them.
export const TMP_PREFIX = 'tmp/';

export function maxBytesOf(kind: MediaKind): number {
  return kind === 'image' ? MAX_IMAGE_BYTES : MAX_PDF_BYTES;
}
