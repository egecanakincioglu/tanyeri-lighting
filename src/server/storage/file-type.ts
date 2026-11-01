export type FileKind = 'jpeg' | 'png' | 'webp' | 'pdf';

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP = [0x57, 0x45, 0x42, 0x50];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];

// Decided from the leading bytes only; the file name and the declared type are never consulted.
export function detectFileKind(bytes: Uint8Array): FileKind | null {
  if (startsWith(bytes, JPEG)) return 'jpeg';
  if (startsWith(bytes, PNG)) return 'png';
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return 'webp';
  if (startsWith(bytes, PDF)) return 'pdf';
  return null;
}
