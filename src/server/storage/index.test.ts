// @vitest-environment node
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startFakeBlobServer } from '../../test/blob-server.ts';
import type { FakeBlobServer } from '../../test/blob-server.ts';
import {
  deleteFile,
  isStorageEnabled,
  MAX_UPLOAD_BYTES,
  StorageDisabledError,
  StorageRequestError,
  UploadRejectedError,
  uploadFile,
} from './index.ts';

const TOKEN = 'vercel_blob_rw_teststore_secretpart';

let server: FakeBlobServer;

beforeAll(async () => {
  server = await startFakeBlobServer();
});

afterAll(async () => {
  await server.close();
});

beforeEach(() => {
  vi.stubEnv('VERCEL_BLOB_API_URL', server.url);
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', TOKEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  server.requests.length = 0;
});

const png = () =>
  sharp({ create: { width: 16, height: 16, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();

describe('with a token', () => {
  it('reports storage as enabled', () => {
    expect(isStorageEnabled()).toBe(true);
  });

  it('writes a re-encoded public image under a generated name', async () => {
    const stored = await uploadFile(new File([await png()], 'my holiday photo.png', { type: 'image/png' }));

    expect(server.requests).toHaveLength(1);
    const [request] = server.requests;
    expect(request?.method).toBe('PUT');
    expect(request?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(request?.headers['x-vercel-blob-access']).toBe('public');
    expect(request?.headers['x-content-type']).toBe('image/webp');
    const pathname = new URL(request?.url ?? '', 'http://fake').searchParams.get('pathname');
    expect(pathname).toMatch(/^[0-9a-f-]{36}\.webp$/);
    expect((await sharp(request?.body).metadata()).format).toBe('webp');
    expect(stored).toMatchObject({ contentType: 'image/webp', size: request?.body.byteLength });
    expect(stored.url).toBe(`https://store.public.blob.vercel-storage.com/${pathname}`);
  });

  it('stores a PDF byte for byte', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.4\nbody\n%%EOF');
    const stored = await uploadFile(new Blob([pdf]));
    expect(server.requests[0]?.body.equals(Buffer.from(pdf))).toBe(true);
    expect(server.requests[0]?.headers['x-content-type']).toBe('application/pdf');
    expect(stored.contentType).toBe('application/pdf');
  });

  it('never calls the store for a rejected file', async () => {
    await expect(uploadFile(new Blob([new Uint8Array(MAX_UPLOAD_BYTES + 1)]))).rejects.toBeInstanceOf(
      UploadRejectedError,
    );
    await expect(uploadFile(new Blob(['<svg/>'], { type: 'image/svg+xml' }))).rejects.toBeInstanceOf(
      UploadRejectedError,
    );
    await expect(uploadFile(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x00])]))).rejects.toBeInstanceOf(
      UploadRejectedError,
    );
    expect(server.requests).toHaveLength(0);
  });

  it('wraps a store failure without leaking the vendor error type', async () => {
    server.failNextWith('forbidden', 403);
    const error = await uploadFile(new Blob(['%PDF-1.4'])).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorageRequestError);
    expect((error as Error).message).toBe('File storage upload failed');
    expect((error as Error).cause).toBeInstanceOf(Error);
  });

  it('deletes by URL', async () => {
    const url = 'https://store.public.blob.vercel-storage.com/a.webp';
    await deleteFile(url);
    const [request] = server.requests;
    expect(request?.method).toBe('POST');
    expect(request?.url).toBe('/delete');
    expect(request?.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(request?.body.toString() ?? '')).toEqual({ urls: [url] });
  });

  it('wraps a delete failure', async () => {
    server.failNextWith('forbidden', 403);
    await expect(deleteFile('https://store.public.blob.vercel-storage.com/a.webp')).rejects.toBeInstanceOf(
      StorageRequestError,
    );
  });
});

describe('without a token', () => {
  beforeEach(() => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
  });

  it('reports storage as disabled', () => {
    expect(isStorageEnabled()).toBe(false);
  });

  it('refuses to upload with a typed error and sends nothing', async () => {
    await expect(uploadFile(new Blob(['%PDF-1.4']))).rejects.toBeInstanceOf(StorageDisabledError);
    expect(server.requests).toHaveLength(0);
  });

  it('refuses to delete with a typed error and sends nothing', async () => {
    await expect(deleteFile('https://store.public.blob.vercel-storage.com/a.webp')).rejects.toBeInstanceOf(
      StorageDisabledError,
    );
    expect(server.requests).toHaveLength(0);
  });
});
