import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeMediaAction } from './upload-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), finalizeUpload: vi.fn() }));

vi.mock('../auth/guard.ts', () => ({
  guardAction: mocks.guardAction,
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../storage/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../storage/index.ts')>()),
  finalizeUpload: mocks.finalizeUpload,
}));

const TEMPORARY = 'https://store.public.blob.vercel-storage.com/tmp/upload-abc';

describe('finalizeMediaAction', () => {
  beforeEach(() => {
    mocks.guardAction.mockClear();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.finalizeUpload.mockClear();
    mocks.finalizeUpload.mockResolvedValue({
      url: 'https://store.example.com/a.webp',
      contentType: 'image/webp',
      size: 3,
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('finalizes the file and returns its address', async () => {
    expect(await finalizeMediaAction(TEMPORARY, 'image')).toEqual({
      status: 'success',
      url: 'https://store.example.com/a.webp',
    });
    expect(mocks.finalizeUpload).toHaveBeenCalledWith(TEMPORARY, 'image');
  });

  it('refuses a request without a session before anything is touched', async () => {
    const { UnauthorizedError } = await import('../auth/guard.ts');
    mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    expect(await finalizeMediaAction(TEMPORARY, 'image')).toMatchObject({ code: 'unauthorized' });
    expect(mocks.finalizeUpload).not.toHaveBeenCalled();
  });

  it('refuses uploads in demo mode before anything is touched', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    expect(await finalizeMediaAction(TEMPORARY, 'image')).toMatchObject({ code: 'demo' });
    expect(mocks.finalizeUpload).not.toHaveBeenCalled();
  });

  it('answers invalid for an unknown kind or a non-text address', async () => {
    expect(await finalizeMediaAction(TEMPORARY, 'video')).toMatchObject({ code: 'invalid' });
    expect(await finalizeMediaAction(42 as unknown as string, 'file')).toMatchObject({ code: 'invalid' });
    expect(mocks.finalizeUpload).not.toHaveBeenCalled();
  });

  it('turns a rejected file and a missing file store into readable codes', async () => {
    const { StorageDisabledError, UploadRejectedError } = await import('../storage/index.ts');
    mocks.finalizeUpload.mockRejectedValueOnce(new UploadRejectedError('too-large', 'x'));
    expect(await finalizeMediaAction(TEMPORARY, 'file')).toMatchObject({ code: 'tooLarge' });
    mocks.finalizeUpload.mockRejectedValueOnce(new StorageDisabledError());
    expect(await finalizeMediaAction(TEMPORARY, 'file')).toMatchObject({ code: 'storageOff' });
  });
});
