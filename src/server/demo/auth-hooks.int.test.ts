import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '../../app/api/auth/[...all]/route.ts';
import { TEST_AUTH_URL } from '../../test/integration-env.ts';
import { createFirstAdmin } from '../auth/admin.ts';
import { getAuth } from '../auth/auth.ts';
import { getDb } from '../db.ts';
import { DEMO_BLOCKED_AUTH_PATHS } from './auth-hooks.ts';

const EMAIL = 'demo@example.com';
const PASSWORD = 'correct horse battery staple';
const OTHER_PASSWORD = 'another long passphrase 42';

// Endpoints that stay open in demo mode: they sign in, sign out, read, or are closed some other way.
const OPEN_AUTH_PATHS: ReadonlySet<string> = new Set([
  '/sign-in/email',
  '/sign-in/social',
  '/sign-up/email',
  '/sign-out',
  '/get-session',
  '/list-sessions',
  '/list-accounts',
  '/account-info',
  '/verify-password',
  '/callback/:id',
  '/reset-password/:token',
  '/ok',
  '/error',
]);

// The sign-in limit is per client address and endpoint, so every request uses an address of its own.
let nextAddress = 1;
function freshAddress(): string {
  return `203.0.113.${nextAddress++}`;
}

function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: TEST_AUTH_URL,
    'x-forwarded-for': freshAddress(),
  });
  if (cookie) headers.set('cookie', cookie);
  return POST(new Request(`${TEST_AUTH_URL}/api/auth${path}`, { method: 'POST', headers, body: JSON.stringify(body) }));
}

async function signInCookie(): Promise<string> {
  const response = await post('/sign-in/email', { email: EMAIL, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ');
}

async function sessionOf(cookie: string): Promise<unknown> {
  const response = await GET(
    new Request(`${TEST_AUTH_URL}/api/auth/get-session`, { headers: { cookie, 'x-forwarded-for': freshAddress() } }),
  );
  expect(response.status).toBe(200);
  return response.json();
}

// The account state a refused request must leave untouched.
async function accountState() {
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({ where: { email: EMAIL } });
  const account = await db.account.findFirstOrThrow({ where: { userId: user.id } });
  return {
    name: user.name,
    email: user.email,
    password: account.password,
    verifications: await db.verification.count(),
    sessions: await db.session.count(),
  };
}

describe('demo mode on the Better Auth endpoints, on a real database', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.rateLimit.deleteMany();
    await db.verification.deleteMany();
    await db.session.deleteMany();
    await db.account.deleteMany();
    await db.user.deleteMany();
    await createFirstAdmin(db, { email: EMAIL, password: PASSWORD });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  describe('with DEMO_MODE=true', () => {
    beforeEach(() => {
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('lets the demo admin sign in, read the session and sign out', async () => {
      const cookie = await signInCookie();
      expect(await sessionOf(cookie)).not.toBeNull();

      const signedOut = await post('/sign-out', {}, cookie);
      expect(signedOut.status).toBe(200);
      expect(await getDb().session.count()).toBe(0);
    });

    it.each([
      ['/change-password', { currentPassword: PASSWORD, newPassword: OTHER_PASSWORD, revokeOtherSessions: true }],
      ['/request-password-reset', { email: EMAIL }],
      ['/reset-password', { newPassword: OTHER_PASSWORD, token: 'any-token' }],
      ['/update-user', { name: 'Someone else' }],
      ['/change-email', { newEmail: 'other@example.com' }],
      ['/delete-user', { password: PASSWORD }],
      ['/revoke-other-sessions', {}],
      ['/revoke-sessions', {}],
    ])('refuses %s with 403 and changes nothing', async (path, body) => {
      const cookie = await signInCookie();
      const before = await accountState();

      const response = await post(path, body, cookie);

      expect(response.status).toBe(403);
      expect(await accountState()).toEqual(before);
      expect(await sessionOf(cookie)).not.toBeNull();
    });

    it('keeps the other sessions alive when revoke-other-sessions is refused', async () => {
      const first = await signInCookie();
      const second = await signInCookie();

      expect((await post('/revoke-other-sessions', {}, first)).status).toBe(403);

      expect(await getDb().session.count()).toBe(2);
      expect(await sessionOf(second)).not.toBeNull();
    });

    it('refuses the reset request before anything is stored, even without a session', async () => {
      const response = await post('/request-password-reset', { email: EMAIL });
      expect(response.status).toBe(403);
      expect(await getDb().verification.count()).toBe(0);
    });
  });

  describe('with DEMO_MODE=false', () => {
    beforeEach(() => {
      vi.stubEnv('DEMO_MODE', 'false');
    });

    it('changes the password', async () => {
      const cookie = await signInCookie();
      const before = await accountState();

      const response = await post(
        '/change-password',
        { currentPassword: PASSWORD, newPassword: OTHER_PASSWORD },
        cookie,
      );

      expect(response.status).toBe(200);
      expect((await accountState()).password).not.toBe(before.password);
    });

    it('updates the user', async () => {
      const cookie = await signInCookie();

      const response = await post('/update-user', { name: 'Someone else' }, cookie);

      expect(response.status).toBe(200);
      expect((await accountState()).name).toBe('Someone else');
    });

    it('revokes the other sessions', async () => {
      const first = await signInCookie();
      const second = await signInCookie();

      expect((await post('/revoke-other-sessions', {}, first)).status).toBe(200);

      expect(await sessionOf(first)).not.toBeNull();
      expect(await sessionOf(second)).toBeNull();
    });
  });

  it('reads the mode per request on the same auth instance', async () => {
    const cookie = await signInCookie();
    vi.stubEnv('DEMO_MODE', 'true');
    expect((await post('/update-user', { name: 'Blocked' }, cookie)).status).toBe(403);
    vi.stubEnv('DEMO_MODE', 'false');
    expect((await post('/update-user', { name: 'Allowed' }, cookie)).status).toBe(200);
  });

  // A library upgrade that adds an endpoint fails here until the path is put on one of the two lists.
  it('has every HTTP endpoint of the library on the blocked or the open list', () => {
    const paths = Object.values(getAuth().api)
      .map((endpoint) => (endpoint as { path?: string }).path)
      .filter((path): path is string => typeof path === 'string');
    expect(paths.length).toBeGreaterThan(20);

    const unclassified = paths.filter((path) => !DEMO_BLOCKED_AUTH_PATHS.has(path) && !OPEN_AUTH_PATHS.has(path));
    expect(unclassified).toEqual([]);

    const both = [...DEMO_BLOCKED_AUTH_PATHS].filter((path) => OPEN_AUTH_PATHS.has(path));
    expect(both).toEqual([]);
    const unknownBlocked = [...DEMO_BLOCKED_AUTH_PATHS].filter((path) => !paths.includes(path));
    expect(unknownBlocked).toEqual([]);
  });
});
