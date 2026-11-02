import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { CLEANUP_BATCH, checkRateLimit } from './index.ts';

const SECOND = 1000;
// A multiple of every window used below, so each test knows exactly where its window starts and ends.
const WINDOW_START = Date.UTC(2026, 10, 1, 12, 0, 0);

function from(address: string): Headers {
  return new Headers({ 'x-forwarded-for': address });
}

function check(
  address: string,
  options: { scope?: string; limit?: number; windowSeconds?: number; address?: string } = {},
) {
  return checkRateLimit({ scope: 'contact', limit: 3, windowSeconds: 60, ...options, headers: from(address) });
}

describe('rate limit counter on a real database', () => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL', '1');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(WINDOW_START + 10 * SECOND);
    await getDb().rateLimitCounter.deleteMany();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('lets requests through up to the limit and refuses the next one', async () => {
    for (let i = 0; i < 3; i++) expect(await check('203.0.113.1')).toEqual({ ok: true });
    expect(await check('203.0.113.1')).toEqual({ ok: false, retryAfterSeconds: 50 });
  });

  it('counts down the time left in the window', async () => {
    for (let i = 0; i < 3; i++) await check('203.0.113.1');
    vi.setSystemTime(WINDOW_START + 59_500);
    expect(await check('203.0.113.1')).toEqual({ ok: false, retryAfterSeconds: 1 });
  });

  it('starts counting again in a new window', async () => {
    for (let i = 0; i < 4; i++) await check('203.0.113.1');
    vi.setSystemTime(WINDOW_START + 60 * SECOND);
    for (let i = 0; i < 3; i++) expect(await check('203.0.113.1')).toEqual({ ok: true });
    expect(await check('203.0.113.1')).toMatchObject({ ok: false });
  });

  it('counts every client together under a shared address', async () => {
    const shared = { limit: 2, address: 'all' };
    expect(await check('203.0.113.1', shared)).toEqual({ ok: true });
    expect(await check('203.0.113.2', shared)).toEqual({ ok: true });
    expect(await check('203.0.113.3', shared)).toMatchObject({ ok: false });
  });

  it('keeps scopes and client addresses apart', async () => {
    for (let i = 0; i < 4; i++) await check('203.0.113.1');
    expect(await check('203.0.113.1')).toMatchObject({ ok: false });
    expect(await check('203.0.113.1', { scope: 'newsletter' })).toEqual({ ok: true });
    expect(await check('203.0.113.2')).toEqual({ ok: true });
  });

  it('never lets more than the limit through under concurrent requests', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => check('203.0.113.1')));
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok)).toHaveLength(17);
    expect(await getDb().rateLimitCounter.count()).toBe(1);
  });

  it('does not store the address or the scope in the key', async () => {
    await check('203.0.113.7');
    const rows = await getDb().rateLimitCounter.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]?.key).not.toContain('203.0.113.7');
    expect(rows[0]?.windowStart).toEqual(new Date(WINDOW_START));
  });

  it('ignores a spoofed x-forwarded-for outside Vercel', async () => {
    vi.stubEnv('VERCEL', '');
    for (let i = 0; i < 3; i++) expect(await check(`198.51.100.${i + 1}`)).toEqual({ ok: true });
    expect(await check('198.51.100.200')).toMatchObject({ ok: false });
    expect(await getDb().rateLimitCounter.count()).toBe(1);
  });

  describe('cleanup', () => {
    const DAY = 24 * 60 * 60 * SECOND;

    function expiredRows(count: number, age: number) {
      return Array.from({ length: count }, (_, i) => ({
        key: `old-${i}`,
        windowStart: new Date(WINDOW_START - age),
        count: 1,
      }));
    }

    it('removes expired rows when a key opens a new window and keeps recent ones', async () => {
      await getDb().rateLimitCounter.createMany({
        data: [
          ...expiredRows(2, DAY + 20 * SECOND),
          { key: 'recent', windowStart: new Date(WINDOW_START - DAY + 20 * SECOND), count: 1 },
        ],
      });
      await check('203.0.113.1');
      const keys = (await getDb().rateLimitCounter.findMany()).map((row) => row.key);
      expect(keys).toContain('recent');
      expect(keys.filter((key) => key.startsWith('old-'))).toEqual([]);
      expect(keys).toHaveLength(2);
    });

    it('removes a bounded number of rows per sweep', async () => {
      await getDb().rateLimitCounter.createMany({ data: expiredRows(CLEANUP_BATCH + 5, 2 * DAY) });
      await check('203.0.113.1');
      expect(await getDb().rateLimitCounter.count({ where: { key: { startsWith: 'old-' } } })).toBe(5);
    });

    it('does not sweep on requests that continue a window', async () => {
      await check('203.0.113.1');
      await getDb().rateLimitCounter.createMany({ data: expiredRows(2, 2 * DAY) });
      await check('203.0.113.1');
      expect(await getDb().rateLimitCounter.count({ where: { key: { startsWith: 'old-' } } })).toBe(2);
    });
  });
});
