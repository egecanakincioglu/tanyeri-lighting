import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_EMAIL, ADMIN_PASSWORD, OTHER_PASSWORD, loginCookie, resetAdmin } from '../../test/auth-http.ts';
import { getDb } from '../db.ts';
import { signInAction } from './sign-in-action.ts';
import { signOutAction } from './sign-out-action.ts';

// `next/headers` has no request outside Next.js. The cookie store records what the library writes.
const request = vi.hoisted(() => ({ headers: new Headers(), cookieSet: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(request.headers),
  cookies: () => Promise.resolve({ set: request.cookieSet }),
}));

// The sign-in limit is per client address, so every test uses an address of its own.
let nextAddress = 1;
function newVisitor(cookie?: string): void {
  const headers = new Headers({ 'x-forwarded-for': `198.51.100.${nextAddress++}` });
  if (cookie) headers.set('cookie', cookie);
  request.headers = headers;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

// next/navigation throws with a digest; the digest holds the redirect target.
async function redirectTarget(call: Promise<unknown>): Promise<string> {
  const error = (await call.then(
    () => null,
    (caught: unknown) => caught,
  )) as { digest?: string } | null;
  const [kind, , target] = error?.digest?.split(';') ?? [];
  expect(kind).toBe('NEXT_REDIRECT');
  return target ?? '';
}

describe('the sign-in and sign-out actions on a real database', () => {
  beforeEach(async () => {
    request.cookieSet.mockClear();
    newVisitor();
    await resetAdmin();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  describe('signInAction', () => {
    it('signs in, stores the session cookie and goes to the panel of the language', async () => {
      const target = await redirectTarget(
        signInAction(null, form({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, locale: 'en' })),
      );
      expect(target).toBe('/en/admin');
      expect(await getDb().session.count()).toBe(1);
      expect(request.cookieSet.mock.calls.map(([name]) => String(name))).toContain('better-auth.session_token');
    });

    it('removes expired sessions after a good sign-in and keeps the live ones', async () => {
      const db = getDb();
      const expired = { token: 'old-token', userId: 'user-1', expiresAt: new Date(Date.now() - 1000) };
      const live = { token: 'live-token', userId: 'user-1', expiresAt: new Date(Date.now() + 3_600_000) };
      await db.session.createMany({
        data: [
          { id: 'session-old', ...expired },
          { id: 'session-live', ...live },
        ],
      });
      await redirectTarget(signInAction(null, form({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, locale: 'en' })));
      const ids = (await db.session.findMany()).map((row) => row.id);
      expect(ids).toContain('session-live');
      expect(ids).not.toContain('session-old');
    });

    it('does not sweep after a refused sign-in', async () => {
      await getDb().session.create({
        data: { id: 'session-old', token: 'old-token', userId: 'user-1', expiresAt: new Date(Date.now() - 1000) },
      });
      await signInAction(null, form({ email: ADMIN_EMAIL, password: OTHER_PASSWORD }));
      expect(await getDb().session.count()).toBe(1);
    });

    it('still signs in when the sweep fails', async () => {
      const sweep = vi.spyOn(getDb().session, 'deleteMany').mockRejectedValueOnce(new Error('sweep failed'));
      const target = await redirectTarget(
        signInAction(null, form({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, locale: 'en' })),
      );
      expect(target).toBe('/en/admin');
      expect(sweep).toHaveBeenCalledTimes(1);
      sweep.mockRestore();
    });

    it('goes to the Turkish panel for Turkish and for an unknown language value', async () => {
      expect(await redirectTarget(signInAction(null, form({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })))).toBe(
        '/tr/yonetim',
      );
      newVisitor();
      const hostile = form({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, locale: '//evil.example', next: '/x' });
      expect(await redirectTarget(signInAction(null, hostile))).toBe('/tr/yonetim');
    });

    it('refuses a wrong password and keeps the address for the form', async () => {
      const result = await signInAction(null, form({ email: ADMIN_EMAIL, password: OTHER_PASSWORD }));
      expect(result).toEqual({ status: 'error', email: ADMIN_EMAIL });
      expect(await getDb().session.count()).toBe(0);
      expect(request.cookieSet).not.toHaveBeenCalled();
    });

    it('gives an unknown address the same answer as a wrong password', async () => {
      const wrong = await signInAction(null, form({ email: ADMIN_EMAIL, password: OTHER_PASSWORD }));
      const unknown = await signInAction(null, form({ email: 'nobody@example.com', password: OTHER_PASSWORD }));
      expect(unknown.status).toBe(wrong.status);
      expect(Object.keys(unknown)).toEqual(Object.keys(wrong));
    });

    it('refuses empty fields and a malformed address with the same answer', async () => {
      expect((await signInAction(null, form({ email: '', password: '' }))).status).toBe('error');
      expect((await signInAction(null, form({ email: 'not-an-address', password: OTHER_PASSWORD }))).status).toBe(
        'error',
      );
    });

    it('applies the limit of the auth layer to repeated attempts from one address', async () => {
      const attempt = () => signInAction(null, form({ email: ADMIN_EMAIL, password: OTHER_PASSWORD }));
      const statuses = [];
      for (let i = 0; i < 4; i++) statuses.push((await attempt()).status);
      expect(statuses).toEqual(['error', 'error', 'error', 'rate-limited']);
      const blocked = await signInAction(null, form({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
      expect(blocked.status).toBe('rate-limited');
      expect(await getDb().session.count()).toBe(0);
    });
  });

  describe('signOutAction', () => {
    it('ends the session and goes to the sign-in page of the language', async () => {
      newVisitor(await loginCookie({ address: '192.0.2.50' }));
      expect(await getDb().session.count()).toBe(1);
      expect(await redirectTarget(signOutAction(form({ locale: 'en' })))).toBe('/en/admin/sign-in');
      expect(await getDb().session.count()).toBe(0);
      const cleared = request.cookieSet.mock.calls.find(([name]) => String(name) === 'better-auth.session_token');
      expect(cleared?.[2]).toMatchObject({ maxAge: 0 });
    });

    it('only redirects a visitor without a session', async () => {
      expect(await redirectTarget(signOutAction(form({ locale: 'tr' })))).toBe('/tr/yonetim/giris');
      expect(request.cookieSet).not.toHaveBeenCalled();
    });
  });
});
