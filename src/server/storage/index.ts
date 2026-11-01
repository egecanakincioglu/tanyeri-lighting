import { randomUUID } from 'node:crypto';
import { del, put } from '@vercel/blob';
import { getBlobToken } from '../env.ts';
import { StorageDisabledError, StorageRequestError } from './errors.ts';
import { prepareUpload } from './prepare.ts';

export { StorageDisabledError, StorageRequestError, UploadRejectedError } from './errors.ts';
export { MAX_UPLOAD_BYTES } from './prepare.ts';

export interface StoredFile {
  url: string;
  contentType: string;
  size: number;
}

// Callers (and the panel) ask this before offering an upload; the token's value never leaves env.ts.
export function isStorageEnabled(): boolean {
  return getBlobToken() !== undefined;
}

function requireToken(): string {
  const token = getBlobToken();
  if (token === undefined) throw new StorageDisabledError();
  return token;
}

// The only door to the file store (ADR 0002 rule 8). Rejects oversize, wrongly typed and undecodable
// files before anything is written; the stored name is generated, never taken from the visitor.
export async function uploadFile(file: Blob): Promise<StoredFile> {
  const token = requireToken();
  const prepared = await prepareUpload(file);
  try {
    const result = await put(`${randomUUID()}.${prepared.extension}`, prepared.bytes, {
      access: 'public',
      contentType: prepared.contentType,
      token,
    });
    return { url: result.url, contentType: prepared.contentType, size: prepared.bytes.byteLength };
  } catch (error) {
    throw new StorageRequestError('upload', error);
  }
}

export async function deleteFile(url: string): Promise<void> {
  const token = requireToken();
  try {
    await del(url, { token });
  } catch (error) {
    throw new StorageRequestError('delete', error);
  }
}
