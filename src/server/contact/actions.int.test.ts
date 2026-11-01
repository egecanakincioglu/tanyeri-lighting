import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { submitContactMessage } from './actions.ts';
import { HONEYPOT_FIELD } from './form.ts';

// The request headers of the code under test; `next/headers` has no request to read from outside Next.js.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(request.headers) }));

const VALID = {
  name: 'Ayse Yilmaz',
  email: 'ayse@example.com',
  subject: 'Quote request',
  message: 'Hello, I would like a quote.',
  locale: 'tr',
};

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...VALID, ...overrides })) data.set(key, value);
  return data;
}

function submit(data: FormData = form()) {
  return submitContactMessage(null, data);
}

describe('the contact form action on a real database', () => {
  beforeEach(async () => {
    vi.stubEnv('VERCEL', '1');
    request.headers = new Headers({ 'x-forwarded-for': '203.0.113.7' });
    const db = getDb();
    await db.contactMessage.deleteMany();
    await db.rateLimitCounter.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('stores a valid message with the visitor locale and answers ok', async () => {
    expect(await submit(form({ locale: 'en' }))).toEqual({ status: 'ok' });
    const rows = await getDb().contactMessage.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...VALID, locale: 'en', readAt: null });
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('stores the trimmed values', async () => {
    await submit(form({ name: '  Ayse  ' }));
    expect(await getDb().contactMessage.findFirstOrThrow()).toMatchObject({ name: 'Ayse' });
  });

  it('returns the field errors and stores nothing for invalid input', async () => {
    expect(await submit(form({ email: 'nope', subject: '' }))).toEqual({
      status: 'invalid',
      fieldErrors: { email: 'invalid', subject: 'required' },
    });
    expect(await getDb().contactMessage.count()).toBe(0);
  });

  it('does not count invalid submissions against the limit', async () => {
    for (let i = 0; i < 6; i++) await submit(form({ email: 'nope' }));
    expect(await submit()).toEqual({ status: 'ok' });
  });

  it('refuses the sixth submission in the window and stores nothing for it', async () => {
    for (let i = 0; i < 5; i++) expect(await submit()).toEqual({ status: 'ok' });
    const result = await submit();
    expect(result).toMatchObject({ status: 'rate-limited' });
    expect((result as { retryAfterSeconds: number }).retryAfterSeconds).toBeGreaterThan(0);
    expect((result as { retryAfterSeconds: number }).retryAfterSeconds).toBeLessThanOrEqual(3600);
    expect(await getDb().contactMessage.count()).toBe(5);
  });

  it('limits each client address on its own', async () => {
    for (let i = 0; i < 6; i++) await submit();
    request.headers = new Headers({ 'x-forwarded-for': '203.0.113.8' });
    expect(await submit()).toEqual({ status: 'ok' });
  });

  it('accepts a filled honeypot without storing anything or counting it', async () => {
    for (let i = 0; i < 6; i++)
      expect(await submit(form({ [HONEYPOT_FIELD]: 'https://spam.example' }))).toEqual({ status: 'ok' });
    expect(await getDb().contactMessage.count()).toBe(0);
    expect(await getDb().rateLimitCounter.count()).toBe(0);
  });

  it('answers a honeypot submission ok even when the other fields are invalid', async () => {
    expect(await submit(form({ [HONEYPOT_FIELD]: 'x', email: 'nope' }))).toEqual({ status: 'ok' });
  });

  describe('in demo mode', () => {
    beforeEach(() => {
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('returns a summary and stores nothing', async () => {
      expect(await submit()).toEqual({
        status: 'demo',
        summary: { name: VALID.name, email: VALID.email, subject: VALID.subject, message: VALID.message },
      });
      expect(await getDb().contactMessage.count()).toBe(0);
    });

    it('still validates', async () => {
      expect(await submit(form({ message: '' }))).toEqual({
        status: 'invalid',
        fieldErrors: { message: 'required' },
      });
    });

    it('still applies the rate limit', async () => {
      for (let i = 0; i < 5; i++) expect(await submit()).toMatchObject({ status: 'demo' });
      expect(await submit()).toMatchObject({ status: 'rate-limited' });
    });
  });
});
