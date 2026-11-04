import { randomUUID } from 'node:crypto';
import { copy, del, head, put } from '@vercel/blob';
import { blobHostname } from '../../lib/blob-hostname.ts';
import { maxBytesOf, TMP_PREFIX, type MediaKind } from '../../lib/upload-limits.ts';
import { getBlobToken } from '../env.ts';
import { StorageDisabledError, StorageRequestError, UploadRejectedError } from './errors.ts';
import { detectFileKind } from './file-type.ts';
import { encodeImage } from './prepare.ts';

export { StorageDisabledError, StorageRequestError, UploadRejectedError } from './errors.ts';

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

// How many leading bytes decide the real type (the longest signature, WebP, is 12).
const SNIFF_BYTES = 16;

// Only an address inside this store's own temporary folder is accepted, so the step can not be used to fetch or
// delete anything else. The address is rebuilt from the parsed URL.
function temporaryAddress(address: string, token: string): URL {
  const rejected = new UploadRejectedError('invalid-address', 'The address is not a temporary file of this store');
  const host = blobHostname(token);
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw rejected;
  }
  const plain = url.username === '' && url.password === '' && url.search === '' && url.hash === '';
  if (url.protocol !== 'https:' || url.host !== host || !plain || !url.pathname.startsWith(`/${TMP_PREFIX}`)) {
    throw rejected;
  }
  return url;
}

async function leadingBytes(url: URL): Promise<Uint8Array> {
  const response = await fetch(url, { headers: { range: `bytes=0-${SNIFF_BYTES - 1}` }, redirect: 'error' });
  if (!response.ok) throw new StorageRequestError('lookup', new Error(`Status ${response.status}`));
  const bytes = new Uint8Array(await response.arrayBuffer());
  return bytes.subarray(0, SNIFF_BYTES);
}

// The second step of an upload (ADR 0002 rule 8): the browser has put the file into tmp/ of the store; this checks it
// and stores the result under a generated name. The size comes from the store, the type from the first bytes (the
// claimed type and name are ignored), and `kind` is what the field accepts: a picture field refuses a PDF and the
// reverse. Pictures are re-encoded; a PDF is copied inside the store without passing through this process. The
// temporary file is removed whatever the outcome.
export async function finalizeUpload(address: string, kind: MediaKind): Promise<StoredFile> {
  const token = requireToken();
  const temporary = temporaryAddress(address, token);
  try {
    const { size } = await head(temporary.href, { token }).catch((error: unknown) => {
      throw new StorageRequestError('lookup', error);
    });
    if (size > maxBytesOf(kind)) {
      throw new UploadRejectedError('too-large', `File is larger than ${maxBytesOf(kind)} bytes`);
    }
    const detected = detectFileKind(await leadingBytes(temporary));
    const isPdf = detected === 'pdf';
    if (detected === null || isPdf !== (kind === 'file')) {
      throw new UploadRejectedError('unsupported-type', 'The file is not of the type this field accepts');
    }
    if (isPdf) {
      const result = await copy(temporary.href, `${randomUUID()}.pdf`, {
        access: 'public',
        contentType: 'application/pdf',
        token,
      }).catch((error: unknown) => {
        throw new StorageRequestError('upload', error);
      });
      return { url: result.url, contentType: 'application/pdf', size };
    }
    const response = await fetch(temporary, { redirect: 'error' });
    if (!response.ok) throw new StorageRequestError('lookup', new Error(`Status ${response.status}`));
    const bytes = await encodeImage(new Uint8Array(await response.arrayBuffer()));
    const result = await put(`${randomUUID()}.webp`, bytes, {
      access: 'public',
      contentType: 'image/webp',
      token,
    }).catch((error: unknown) => {
      throw new StorageRequestError('upload', error);
    });
    return { url: result.url, contentType: 'image/webp', size: bytes.byteLength };
  } finally {
    // A file that stays behind is only clutter in tmp/; it must not hide the real outcome.
    await del(temporary.href, { token }).catch(() => undefined);
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

// The size of a stored file as the file store reports it, so a size saved next to an address is never taken from the
// browser.
export async function storedFileSize(url: string): Promise<number> {
  const token = requireToken();
  try {
    return (await head(url, { token })).size;
  } catch (error) {
    throw new StorageRequestError('lookup', error);
  }
}
