import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discardReplacedFile } from './files.ts';

const storage = vi.hoisted(() => ({ deleteFile: vi.fn(), isStorageEnabled: vi.fn() }));
vi.mock('../storage/index.ts', () => storage);

const STORED = 'https://abc123.public.blob.vercel-storage.com/old-photo.webp';

describe('discardReplacedFile', () => {
  beforeEach(() => {
    storage.deleteFile.mockClear();
    storage.deleteFile.mockResolvedValue(undefined);
    storage.isStorageEnabled.mockClear();
    storage.isStorageEnabled.mockReturnValue(true);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('deletes the old file of the file store after it was replaced or removed', async () => {
    await discardReplacedFile(STORED, 'https://abc123.public.blob.vercel-storage.com/new-photo.webp');
    await discardReplacedFile(STORED, null);
    await discardReplacedFile(STORED);
    expect(storage.deleteFile).toHaveBeenCalledTimes(3);
    expect(storage.deleteFile).toHaveBeenCalledWith(STORED);
  });

  it('leaves the file alone when the address did not change', async () => {
    await discardReplacedFile(STORED, STORED);
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it('never touches a demo picture, an empty value or an address of another host', async () => {
    for (const before of [
      '/demo/area-otel.webp',
      '',
      null,
      undefined,
      'https://example.com/photo.webp',
      'https://public.blob.vercel-storage.com.example.com/photo.webp',
      'http://abc123.public.blob.vercel-storage.com/photo.webp',
      'not an address',
    ]) {
      await discardReplacedFile(before, 'https://abc123.public.blob.vercel-storage.com/new.webp');
    }
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it('does nothing in demo mode or while the file store is off', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    await discardReplacedFile(STORED, null);
    vi.unstubAllEnvs();
    storage.isStorageEnabled.mockReturnValue(false);
    await discardReplacedFile(STORED, null);
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });

  it('logs a failure and does not throw, so the save that came before stays done', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    storage.deleteFile.mockRejectedValue(new Error('store is down'));
    await expect(discardReplacedFile(STORED, null)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
