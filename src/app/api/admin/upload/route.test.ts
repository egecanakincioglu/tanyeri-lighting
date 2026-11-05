// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route.ts';

const mocks = vi.hoisted(() => ({ guardHandler: vi.fn(), handleUpload: vi.fn() }));

vi.mock('../../../../server/auth/guard.ts', () => ({ guardHandler: mocks.guardHandler }));
vi.mock('@vercel/blob/client', () => ({ handleUpload: mocks.handleUpload }));

const TOKEN = 'vercel_blob_rw_teststore_secretpart';
const GENERATE = (pathname: string) => ({
  type: 'blob.generate-client-token',
  payload: { pathname, clientPayload: null, multipart: false },
});

function post(body: unknown): Request {
  return new Request('http://localhost/api/admin/upload', { method: 'POST', body: JSON.stringify(body) });
}

type Options = { onBeforeGenerateToken: (pathname: string) => Promise<Record<string, unknown>> };
function callbackOf(): Options['onBeforeGenerateToken'] {
  return (mocks.handleUpload.mock.calls[0]?.[0] as Options).onBeforeGenerateToken;
}

describe('POST /api/admin/upload', () => {
  beforeEach(() => {
    mocks.guardHandler.mockClear();
    mocks.guardHandler.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.handleUpload.mockClear();
    mocks.handleUpload.mockResolvedValue({ type: 'blob.generate-client-token', clientToken: 'issued' });
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', TOKEN);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('answers 401 without a session and issues nothing', async () => {
    mocks.guardHandler.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const response = await POST(post(GENERATE('tmp/upload')));
    expect(response.status).toBe(401);
    expect(mocks.handleUpload).not.toHaveBeenCalled();
  });

  it('answers 403 in demo mode and issues nothing', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    const response = await POST(post(GENERATE('tmp/upload')));
    expect(response.status).toBe(403);
    expect(mocks.handleUpload).not.toHaveBeenCalled();
  });

  it('answers 503 when file storage is off', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '');
    expect((await POST(post(GENERATE('tmp/upload')))).status).toBe(503);
    expect(mocks.handleUpload).not.toHaveBeenCalled();
  });

  it('answers 400 for a body that is not JSON', async () => {
    const response = await POST(new Request('http://localhost/api/admin/upload', { method: 'POST', body: 'x' }));
    expect(response.status).toBe(400);
  });

  it('issues a short-lived token for the temporary folder with the type list and the outer size cap', async () => {
    const response = await POST(post(GENERATE('tmp/upload')));
    expect(await response.json()).toEqual({ type: 'blob.generate-client-token', clientToken: 'issued' });
    expect(mocks.handleUpload.mock.calls[0]?.[0]).toMatchObject({ token: TOKEN });

    const before = Date.now();
    const options = await callbackOf()('tmp/upload');
    expect(options).toMatchObject({
      allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      maximumSizeInBytes: 50 * 1024 * 1024,
      addRandomSuffix: true,
    });
    const validUntil = options.validUntil as number;
    expect(validUntil).toBeGreaterThan(before);
    expect(validUntil - before).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
    expect(options).not.toHaveProperty('callbackUrl');
  });

  it('refuses any pathname outside the temporary folder', async () => {
    await POST(post(GENERATE('tmp/upload')));
    for (const pathname of ['final.webp', 'tmp', 'tmpx/a', '/tmp/a', 'tmp/../a', 'tmp/a/b', 'tmp/', 'other/tmp/a']) {
      await expect(callbackOf()(pathname), pathname).rejects.toThrow();
    }
  });

  it('answers 400 when the library refuses the request', async () => {
    mocks.handleUpload.mockRejectedValue(new Error('bad'));
    expect((await POST(post(GENERATE('tmp/upload')))).status).toBe(400);
  });
});
