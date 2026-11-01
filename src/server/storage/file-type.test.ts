// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { detectFileKind } from './file-type.ts';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => new TextEncoder().encode(text);

describe('detectFileKind', () => {
  it('recognises JPEG, PNG, WebP and PDF by their leading bytes', () => {
    expect(detectFileKind(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe('jpeg');
    expect(detectFileKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('png');
    expect(detectFileKind(ascii('RIFF\0\0\0\0WEBPVP8 '))).toBe('webp');
    expect(detectFileKind(ascii('%PDF-1.7\n'))).toBe('pdf');
  });

  it('rejects SVG and other text formats', () => {
    expect(detectFileKind(ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectFileKind(ascii('<?xml version="1.0"?><svg/>'))).toBeNull();
    expect(detectFileKind(ascii('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(detectFileKind(ascii('GIF89a'))).toBeNull();
  });

  it('rejects a RIFF container that is not WebP', () => {
    expect(detectFileKind(ascii('RIFF\0\0\0\0WAVEfmt '))).toBeNull();
  });

  it('rejects a PDF marker that is not at the very start', () => {
    expect(detectFileKind(ascii(' %PDF-1.7'))).toBeNull();
  });

  it('rejects empty and too-short input without throwing', () => {
    expect(detectFileKind(new Uint8Array())).toBeNull();
    expect(detectFileKind(bytes(0xff, 0xd8))).toBeNull();
    expect(detectFileKind(ascii('RIFF'))).toBeNull();
  });
});
