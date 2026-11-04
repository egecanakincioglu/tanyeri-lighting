import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES, maxBytesOf } from './upload-limits.ts';

describe('maxBytesOf', () => {
  it('gives 20 MB for pictures and 50 MB for files', () => {
    expect(maxBytesOf('image')).toBe(MAX_IMAGE_BYTES);
    expect(maxBytesOf('file')).toBe(MAX_PDF_BYTES);
    expect(MAX_IMAGE_BYTES).toBe(20 * 1024 * 1024);
    expect(MAX_PDF_BYTES).toBe(50 * 1024 * 1024);
  });
});
