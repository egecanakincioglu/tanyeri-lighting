import { hashPassword } from 'better-auth/crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/auth/[...all]/route.ts';
import { TEST_AUTH_URL } from '../../test/integration-env.ts';
import { getDb } from '../db.ts';
import { guardAction, guardHandler, guardPage, UnauthorizedError } from './guard.ts';

// The request headers of the code under test; `next/headers` has no request to read from outside Next.js.
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(request.headers) }));

const EMAIL = 'admin@example.com';
const PASSWORD = 'correct horse battery staple';

// The sign-in limit is per client address, so every sign-in uses an address of its own.
let nextAddress = 1;

async function signInCookie(): Promise<string> {
  const response = await POST(
    new Request(`${TEST_AUTH_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: TEST_AUTH_URL,
        'x-forwarded-for': `203.0.114.${nextAddress++}`,
      },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    }),
  );
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ');
}

// next/navigation throws an error with a digest instead of returning; the digest carries the redirect target.
async function redirectTarget(call: Promise<unknown>): Promise<string> {
  const error = (await call.then(
    () => null,
    (caught: unknown) => caught,
  )) as { digest?: string } | null;
  const [kind, , target] = error?.digest?.split(';') ?? [];
  expect(kind).toBe('NEXT_REDIRECT');
  return target ?? '';
}

describe('the admin guard on a real database', () => {
  beforeEach(async () => {
    request.headers = new Headers();
    const db = getDb();
    await db.rateLimit.deleteMany();
    await db.session.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
    const user = await db.user.create({ data: { id: 'user-1', name: 'Admin', email: EMAIL, emailVerified: true } });
    await db.account.create({
      data: {
        id: 'account-1',
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: await hashPassword(PASSWORD),
      },
    });
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  describe('without a session', () => {
    it('sends a page visitor to the sign-in page of the locale', async () => {
      expect(await redirectTarget(guardPage('en'))).toBe('/en/dashboard/sign-in');
      expect(await redirectTarget(guardPage('tr'))).toBe('/tr/dashboard/sign-in');
    });

    it('keeps an unknown locale out of the redirect target', async () => {
      expect(await redirectTarget(guardPage('//evil.example'))).toBe('/tr/dashboard/sign-in');
    });

    it('throws an error, not a redirect, for a Server Action', async () => {
      await expect(guardAction()).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('answers a route handler with a 401 JSON response', async () => {
      const result = await guardHandler();
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(401);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
    });

    it('rejects a cookie whose session was revoked', async () => {
      request.headers = new Headers({ cookie: await signInCookie() });
      await getDb().session.deleteMany();
      await expect(guardAction()).rejects.toBeInstanceOf(UnauthorizedError);
    });
  });

  describe('with a valid session', () => {
    beforeEach(async () => {
      request.headers = new Headers({ cookie: await signInCookie() });
    });

    it('lets a page through and returns the session', async () => {
      const session = await guardPage('en');
      expect(session.user.email).toBe(EMAIL);
    });

    it('lets a Server Action through and returns the session', async () => {
      expect((await guardAction()).user.id).toBe('user-1');
    });

    it('lets a route handler through and returns the session, not a response', async () => {
      const result = await guardHandler();
      expect(result).not.toBeInstanceOf(Response);
      expect((result as { user: { id: string } }).user.id).toBe('user-1');
    });
  });
});
