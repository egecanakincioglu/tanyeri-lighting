import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../../../server/db.ts';
import { POST } from './route.ts';

// Outside a request `after` has nothing to attach to; the test runs what it was given, like the host does later.
const queued = vi.hoisted(() => ({ tasks: [] as (() => Promise<void>)[] }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => queued.tasks.push(task),
}));

const ORIGIN = 'https://example.test';

function send(body: string, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request(`${ORIGIN}/api/visits`, {
      method: 'POST',
      body,
      headers: {
        origin: ORIGIN,
        'content-type': 'text/plain;charset=UTF-8',
        'content-length': String(new TextEncoder().encode(body).length),
        ...headers,
      },
    }),
  );
}

async function flush(): Promise<void> {
  await Promise.all(queued.tasks.splice(0).map((task) => task()));
}

describe('POST /api/visits on a real database', () => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL', '1');
    queued.tasks.length = 0;
    await getDb().visit.deleteMany();
    await getDb().rateLimitCounter.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('answers 204 at once and writes after the response', async () => {
    const response = await send('/tr/urunler', {
      'x-forwarded-for': '203.0.113.77',
      'x-vercel-ip-country': 'TR',
      'x-vercel-ip-city': 'Istanbul',
    });
    expect(response.status).toBe(204);
    expect(await getDb().visit.count()).toBe(0);
    await flush();
    expect(await getDb().visit.findFirstOrThrow()).toMatchObject({
      country: 'TR',
      city: 'Istanbul',
      address: '203.0.113.0',
      views: 1,
    });
  });

  it('makes one row with a growing count for many requests from one address', async () => {
    for (let index = 0; index < 10; index += 1) {
      await send(index % 2 ? '/tr/urunler' : '/en/contact', { 'x-forwarded-for': '203.0.113.5' });
    }
    await send('/tr', { 'x-forwarded-for': '203.0.113.200' });
    await flush();
    const rows = await getDb().visit.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ address: '203.0.113.0', views: 11 });
  });

  it('never stores a plain address, a referrer or the path', async () => {
    const response = await send('/en/products', {
      'x-forwarded-for': '203.0.113.77',
      referer: 'https://search.example/?q=lamp',
    });
    expect(response.status).toBe(204);
    await flush();
    const text = JSON.stringify(await getDb().visit.findMany());
    expect(text).not.toContain('203.0.113.77');
    expect(text).not.toContain('search.example');
    expect(text).not.toContain('products');
  });

  it('stores an IPv6 visitor as its /48', async () => {
    await send('/en', { 'x-forwarded-for': '2001:db8:1:2:aaaa:bbbb:cccc:dddd' });
    await flush();
    const row = await getDb().visit.findFirstOrThrow();
    expect(row.address).toBe('2001:db8:1::');
    expect(JSON.stringify(row)).not.toContain('aaaa');
  });

  it('stores null place and an unknown address when the host sends no headers', async () => {
    await send('/en');
    await flush();
    expect(await getDb().visit.findFirstOrThrow()).toMatchObject({ country: null, city: null, address: 'unknown' });
  });

  it('records in demo mode too: it keeps no personal data', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    expect((await send('/en/contact')).status).toBe(204);
    await flush();
    expect(await getDb().visit.count()).toBe(1);
  });

  it('refuses a request from another origin', async () => {
    expect((await send('/tr', { origin: 'https://other.example' })).status).toBe(403);
    expect(queued.tasks).toHaveLength(0);
  });

  it('refuses a request without an origin', async () => {
    const response = await POST(
      new Request(`${ORIGIN}/api/visits`, { method: 'POST', body: '/tr', headers: { 'content-length': '3' } }),
    );
    expect(response.status).toBe(403);
    expect(queued.tasks).toHaveLength(0);
  });

  it('refuses an oversized body before reading it, with no database write', async () => {
    const count = vi.spyOn(Request.prototype, 'text');
    const response = await send(`/tr/${'a'.repeat(300)}`);
    expect(response.status).toBe(413);
    expect(count).not.toHaveBeenCalled();
    count.mockRestore();
    expect(queued.tasks).toHaveLength(0);
    expect(await getDb().rateLimitCounter.count()).toBe(0);
    expect(await getDb().visit.count()).toBe(0);
  });

  it.each([undefined, '0', 'abc'])('refuses a missing or invalid content length %s', async (length) => {
    const headers: Record<string, string> = { origin: ORIGIN };
    if (length !== undefined) headers['content-length'] = length;
    const response = await POST(new Request(`${ORIGIN}/api/visits`, { method: 'POST', body: '/tr', headers }));
    expect(response.status).toBe(411);
    expect(queued.tasks).toHaveLength(0);
  });

  it.each(['/tr/yonetim', '/en/admin/messages', '/tr/bilinmeyen', 'https://example.com'])(
    'refuses %j and writes nothing',
    async (body) => {
      expect((await send(body)).status).toBe(400);
      await flush();
      expect(await getDb().visit.count()).toBe(0);
    },
  );

  it('refuses with 429 once a visitor passes the limit, and does not touch the table', async () => {
    const headers = { 'x-forwarded-for': '203.0.113.5' };
    for (let index = 0; index < 120; index += 1) expect((await send('/tr', headers)).status).toBe(204);
    const limited = await send('/tr', headers);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    await flush();
    expect((await getDb().visit.findFirstOrThrow()).views).toBe(120);
  });

  it('counts visitors apart: another address is not limited', async () => {
    for (let index = 0; index < 121; index += 1) await send('/tr', { 'x-forwarded-for': '203.0.113.5' });
    expect((await send('/tr', { 'x-forwarded-for': '198.51.100.9' })).status).toBe(204);
  });
});
