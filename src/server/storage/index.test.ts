// @vitest-environment node
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteFile,
  finalizeUpload,
  isStorageEnabled,
  StorageDisabledError,
  StorageRequestError,
  storedFileSize,
  UploadRejectedError,
} from './index.ts';

const blob = vi.hoisted(() => ({ copy: vi.fn(), del: vi.fn(), head: vi.fn(), put: vi.fn() }));
vi.mock('@vercel/blob', () => blob);

const TOKEN = 'vercel_blob_rw_teststore_secretpart';
const HOST = 'https://teststore.public.blob.vercel-storage.com';
const TEMPORARY = `${HOST}/tmp/upload-abc123`;

const PDF = new TextEncoder().encode('%PDF-1.4\nbody\n%%EOF');
const png = () =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();

const fetchMock = vi.fn<typeof fetch>();

// The store answers a range request with the leading bytes and a plain request with the whole file.
function storeHolds(bytes: Uint8Array) {
  fetchMock.mockImplementation((_input, init) => {
    const range = new Headers(init?.headers).get('range');
    const body = range ? bytes.subarray(0, 16) : bytes;
    return Promise.resolve(new Response(Buffer.from(body), { status: range ? 206 : 200 }));
  });
  blob.head.mockResolvedValue({ size: bytes.byteLength });
}

beforeEach(() => {
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', TOKEN);
  vi.stubGlobal('fetch', fetchMock);
  for (const fn of [fetchMock, blob.copy, blob.del, blob.head, blob.put]) fn.mockClear();
  blob.del.mockResolvedValue(undefined);
  blob.copy.mockResolvedValue({ url: `${HOST}/final.pdf` });
  blob.put.mockResolvedValue({ url: `${HOST}/final.webp` });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (caught: unknown) => caught,
  );
}

describe('finalizeUpload with a token', () => {
  it('reports storage as enabled', () => {
    expect(isStorageEnabled()).toBe(true);
  });

  it('re-encodes a picture into WebP, stores it under a generated name and removes the temporary file', async () => {
    storeHolds(await png());
    const stored = await finalizeUpload(TEMPORARY, 'image');

    const [pathname, bytes, options] = blob.put.mock.calls[0] as [string, Buffer, Record<string, unknown>];
    expect(pathname).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect((await sharp(bytes).metadata()).format).toBe('webp');
    expect(options).toMatchObject({ access: 'public', contentType: 'image/webp' });
    expect(stored).toEqual({ url: `${HOST}/final.webp`, contentType: 'image/webp', size: bytes.byteLength });
    expect(blob.del).toHaveBeenCalledWith(TEMPORARY, expect.anything());
  });

  it('copies a PDF inside the store and never downloads more than its first bytes', async () => {
    storeHolds(PDF);
    const stored = await finalizeUpload(TEMPORARY, 'file');

    const [from, to, options] = blob.copy.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(from).toBe(TEMPORARY);
    expect(to).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(options).toMatchObject({ access: 'public', contentType: 'application/pdf' });
    expect(stored).toEqual({ url: `${HOST}/final.pdf`, contentType: 'application/pdf', size: PDF.byteLength });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('range')).toBe('bytes=0-15');
    expect(blob.put).not.toHaveBeenCalled();
    expect(blob.del).toHaveBeenCalledWith(TEMPORARY, expect.anything());
  });

  it('refuses an address that is not a temporary file of this store without fetching or deleting anything', async () => {
    const bad = [
      `http://teststore.public.blob.vercel-storage.com/tmp/a`,
      'https://other.public.blob.vercel-storage.com/tmp/a',
      'https://teststore.public.blob.vercel-storage.com.evil.example/tmp/a',
      'https://user@teststore.public.blob.vercel-storage.com/tmp/a',
      'https://teststore.public.blob.vercel-storage.com:8443/tmp/a',
      `${HOST}/final.pdf`,
      `${HOST}/tmpfile/a`,
      `${HOST}/tmp/../final.pdf`,
      `${TEMPORARY}?x=1`,
      'https://example.com/tmp/a',
      'tmp/a',
      '',
    ];
    for (const address of bad) {
      const error = await rejection(finalizeUpload(address, 'file'));
      expect(error, address).toBeInstanceOf(UploadRejectedError);
      expect((error as UploadRejectedError).reason).toBe('invalid-address');
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(blob.head).not.toHaveBeenCalled();
    expect(blob.del).not.toHaveBeenCalled();
  });

  it('refuses a picture over 20 MB and a PDF over 50 MB by the size the store reports, then cleans up', async () => {
    blob.head.mockResolvedValue({ size: 20 * 1024 * 1024 + 1 });
    expect(((await rejection(finalizeUpload(TEMPORARY, 'image'))) as UploadRejectedError).reason).toBe('too-large');
    blob.head.mockResolvedValue({ size: 50 * 1024 * 1024 + 1 });
    expect(((await rejection(finalizeUpload(TEMPORARY, 'file'))) as UploadRejectedError).reason).toBe('too-large');
    storeHolds(PDF);
    blob.head.mockResolvedValue({ size: 30 * 1024 * 1024 });
    await expect(finalizeUpload(TEMPORARY, 'file')).resolves.toMatchObject({ contentType: 'application/pdf' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(blob.del).toHaveBeenCalledTimes(3);
  });

  it('judges the type by the first bytes, not by what was claimed', async () => {
    storeHolds(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'));
    const error = await rejection(finalizeUpload(TEMPORARY, 'image'));
    expect((error as UploadRejectedError).reason).toBe('unsupported-type');
    expect(blob.put).not.toHaveBeenCalled();
    expect(blob.copy).not.toHaveBeenCalled();
  });

  it('refuses a PDF in a picture field and a picture in a file field', async () => {
    storeHolds(PDF);
    expect(((await rejection(finalizeUpload(TEMPORARY, 'image'))) as UploadRejectedError).reason).toBe(
      'unsupported-type',
    );
    storeHolds(await png());
    expect(((await rejection(finalizeUpload(TEMPORARY, 'file'))) as UploadRejectedError).reason).toBe(
      'unsupported-type',
    );
    expect(blob.put).not.toHaveBeenCalled();
    expect(blob.copy).not.toHaveBeenCalled();
  });

  it('removes the temporary file when the file is rejected, the copy fails or the picture is unreadable', async () => {
    storeHolds(new Uint8Array([1, 2, 3, 4]));
    await rejection(finalizeUpload(TEMPORARY, 'file'));
    expect(blob.del).toHaveBeenCalledTimes(1);

    storeHolds(PDF);
    blob.copy.mockRejectedValue(new Error('store down'));
    const error = await rejection(finalizeUpload(TEMPORARY, 'file'));
    expect(error).toBeInstanceOf(StorageRequestError);
    expect(blob.del).toHaveBeenCalledTimes(2);

    storeHolds((await png()).subarray(0, 40));
    const unreadable = await rejection(finalizeUpload(TEMPORARY, 'image'));
    expect((unreadable as UploadRejectedError).reason).toBe('unreadable-image');
    expect(blob.del).toHaveBeenCalledTimes(3);
  });

  it('wraps a failed size lookup and a failed write, and still removes the temporary file', async () => {
    blob.head.mockRejectedValue(new Error('missing'));
    expect(await rejection(finalizeUpload(TEMPORARY, 'file'))).toBeInstanceOf(StorageRequestError);
    expect(blob.del).toHaveBeenCalledTimes(1);

    storeHolds(await png());
    blob.put.mockRejectedValue(new Error('forbidden'));
    expect(await rejection(finalizeUpload(TEMPORARY, 'image'))).toBeInstanceOf(StorageRequestError);
    expect(blob.del).toHaveBeenCalledTimes(2);
  });

  it('fails with a typed error when the temporary file can not be read', async () => {
    blob.head.mockResolvedValue({ size: 10 });
    fetchMock.mockResolvedValue(new Response('no', { status: 404 }));
    expect(await rejection(finalizeUpload(TEMPORARY, 'file'))).toBeInstanceOf(StorageRequestError);
    expect(blob.del).toHaveBeenCalledTimes(1);

    const leading = new Uint8Array(await png());
    blob.head.mockResolvedValue({ size: leading.byteLength });
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        new Headers(init?.headers).get('range')
          ? new Response(Buffer.from(leading.subarray(0, 16)), { status: 206 })
          : new Response('no', { status: 500 }),
      ),
    );
    expect(await rejection(finalizeUpload(TEMPORARY, 'image'))).toBeInstanceOf(StorageRequestError);
  });

  it('does not hide the outcome when removing the temporary file fails', async () => {
    storeHolds(PDF);
    blob.del.mockRejectedValue(new Error('gone'));
    await expect(finalizeUpload(TEMPORARY, 'file')).resolves.toMatchObject({ contentType: 'application/pdf' });
  });
});

describe('with a token', () => {
  it('reports the size the store holds for a stored file', async () => {
    blob.head.mockResolvedValue({ size: 19 });
    expect(await storedFileSize(`${HOST}/a.pdf`)).toBe(19);
  });

  it('wraps a failed size lookup', async () => {
    blob.head.mockRejectedValue(new Error('missing'));
    expect(await rejection(storedFileSize(`${HOST}/none.pdf`))).toBeInstanceOf(StorageRequestError);
  });

  it('deletes by URL and wraps a delete failure', async () => {
    await deleteFile(`${HOST}/a.webp`);
    expect(blob.del).toHaveBeenCalledWith(`${HOST}/a.webp`, expect.anything());
    blob.del.mockRejectedValue(new Error('forbidden'));
    expect(await rejection(deleteFile(`${HOST}/a.webp`))).toBeInstanceOf(StorageRequestError);
  });
});

describe('without a token', () => {
  beforeEach(() => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
  });

  it('reports storage as disabled', () => {
    expect(isStorageEnabled()).toBe(false);
  });

  it('refuses every operation with a typed error and sends nothing', async () => {
    for (const operation of [
      () => finalizeUpload(TEMPORARY, 'file'),
      () => storedFileSize(`${HOST}/a.pdf`),
      () => deleteFile(`${HOST}/a.webp`),
    ]) {
      expect(await rejection(operation())).toBeInstanceOf(StorageDisabledError);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(blob.head).not.toHaveBeenCalled();
    expect(blob.del).not.toHaveBeenCalled();
  });
});
