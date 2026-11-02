import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadMediaAction } from './upload-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), uploadFile: vi.fn() }));

vi.mock('../auth/guard.ts', () => ({
  guardAction: mocks.guardAction,
  UnauthorizedError: class UnauthorizedError extends Error {},
}));
vi.mock('../storage/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../storage/index.ts')>()),
  uploadFile: mocks.uploadFile,
}));

function formWith(file: Blob | string | null): FormData {
  const data = new FormData();
  if (file !== null) data.set('file', file);
  return data;
}

describe('uploadMediaAction', () => {
  beforeEach(() => {
    mocks.guardAction.mockClear();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.uploadFile.mockClear();
    mocks.uploadFile.mockResolvedValue({ url: 'https://store.example.com/a.webp', contentType: 'image/webp', size: 3 });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stores the file and returns its address', async () => {
    const result = await uploadMediaAction(null, formWith(new Blob(['abc'])));
    expect(result).toEqual({ status: 'success', url: 'https://store.example.com/a.webp' });
    expect(mocks.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('refuses a request without a session before anything is stored', async () => {
    const { UnauthorizedError } = await import('../auth/guard.ts');
    mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    expect(await uploadMediaAction(null, formWith(new Blob(['abc'])))).toMatchObject({ code: 'unauthorized' });
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('refuses uploads in demo mode before anything is stored', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    expect(await uploadMediaAction(null, formWith(new Blob(['abc'])))).toMatchObject({ code: 'demo' });
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('answers invalid when there is no file, an empty file or text instead of a file', async () => {
    for (const body of [null, new Blob([]), 'text']) {
      expect(await uploadMediaAction(null, formWith(body))).toMatchObject({ code: 'invalid' });
    }
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it('turns a rejected file and a missing file store into readable codes', async () => {
    const { StorageDisabledError, UploadRejectedError } = await import('../storage/index.ts');
    mocks.uploadFile.mockRejectedValueOnce(new UploadRejectedError('too-large', 'x'));
    expect(await uploadMediaAction(null, formWith(new Blob(['abc'])))).toMatchObject({ code: 'tooLarge' });
    mocks.uploadFile.mockRejectedValueOnce(new StorageDisabledError());
    expect(await uploadMediaAction(null, formWith(new Blob(['abc'])))).toMatchObject({ code: 'storageOff' });
  });
});
