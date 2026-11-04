import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OTHER_PASSWORD,
  loginCookie,
  resetAdmin,
  sessionOf,
  signIn,
} from '../../test/auth-http.ts';
import { getAuth } from '../auth/auth.ts';
import { getDb } from '../db.ts';
import { changeEmailAction, changePasswordAction } from './account-actions.ts';

// The request of the code under test; `next/headers` has no request to read from outside Next.js.
const request = vi.hoisted(() => ({ headers: new Headers(), cookieSet: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(request.headers),
  cookies: () => Promise.resolve({ set: request.cookieSet }),
}));

// The auth limits are per client address, so every test uses an address of its own.
let nextAddress = 1;
function visitor(cookie?: string): void {
  const headers = new Headers({ 'x-forwarded-for': `198.51.100.${nextAddress++}` });
  if (cookie) headers.set('cookie', cookie);
  request.headers = headers;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const change = (extra: Record<string, string> = {}) =>
  form({ currentPassword: ADMIN_PASSWORD, newPassword: OTHER_PASSWORD, confirm: OTHER_PASSWORD, ...extra });

// These tests run without the SMTP variables: email is off. The email change itself is in account-email.int.test.ts.
describe('the account actions on a real database', () => {
  let cookie = '';

  beforeEach(async () => {
    request.cookieSet.mockClear();
    await resetAdmin();
    cookie = await loginCookie({ address: `192.0.2.${nextAddress}` });
    visitor(cookie);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  describe('changePasswordAction', () => {
    it('changes the password and ends every other session, keeping this one with the same cookie', async () => {
      const other = await loginCookie({ address: '192.0.2.200' });
      expect(await getDb().session.count()).toBe(2);
      expect(await changePasswordAction(null, change())).toEqual({ status: 'success' });
      expect(await getDb().session.count()).toBe(1);
      expect(await sessionOf(cookie)).not.toBeNull();
      expect(await sessionOf(other)).toBeNull();
      visitor();
      expect((await signIn(ADMIN_PASSWORD)).status).toBe(401);
      expect((await signIn(OTHER_PASSWORD)).status).toBe(200);
    });

    it('says that other devices may stay signed in when only revoking them fails', async () => {
      const handler = getAuth().handler;
      const spy = vi
        .spyOn(getAuth(), 'handler')
        .mockImplementation((incoming: Request) =>
          incoming.url.endsWith('/revoke-other-sessions')
            ? Promise.resolve(new Response(null, { status: 500 }))
            : handler(incoming),
        );
      const result = await changePasswordAction(null, change());
      spy.mockRestore();
      expect(result).toEqual({ status: 'error', code: 'othersOpen', fields: {} });
      visitor();
      expect((await signIn(OTHER_PASSWORD)).status).toBe(200);
    });

    it('says the current password is wrong and changes nothing', async () => {
      const result = await changePasswordAction(null, change({ currentPassword: 'not the password' }));
      expect(result).toEqual({ status: 'error', code: 'invalid', fields: { currentPassword: 'wrongCurrent' } });
      expect((await signIn(ADMIN_PASSWORD)).status).toBe(200);
    });

    it('gives a field error for every weak or inconsistent input, without calling the auth layer', async () => {
      const issues = async (extra: Record<string, string>) => {
        const result = await changePasswordAction(null, change(extra));
        return result.status === 'error' ? result.fields : result;
      };
      expect(await issues({ currentPassword: '', newPassword: '', confirm: '' })).toEqual({
        currentPassword: 'required',
        newPassword: 'required',
      });
      expect(await issues({ newPassword: 'short', confirm: 'short' })).toEqual({ newPassword: 'tooShort' });
      expect(await issues({ newPassword: 'x'.repeat(11), confirm: 'x'.repeat(11) })).toEqual({
        newPassword: 'tooShort',
      });
      expect(await issues({ newPassword: 'x'.repeat(129), confirm: 'x'.repeat(129) })).toEqual({
        newPassword: 'tooLong',
      });
      expect(await issues({ newPassword: ADMIN_PASSWORD, confirm: ADMIN_PASSWORD })).toEqual({ newPassword: 'same' });
      expect(await issues({ confirm: 'something else entirely' })).toEqual({ confirm: 'mismatch' });
      expect((await signIn(ADMIN_PASSWORD)).status).toBe(200);
    });

    it('applies the limit of the auth layer to repeated attempts from one address', async () => {
      const attempt = () => changePasswordAction(null, change({ currentPassword: 'not the password' }));
      const codes = [];
      for (let i = 0; i < 5; i++) {
        const result = await attempt();
        codes.push(result.status === 'error' ? result.code : result.status);
      }
      expect(codes).toContain('rateLimited');
      expect(codes[0]).toBe('invalid');
    });

    it('refuses a visitor without a session', async () => {
      visitor();
      expect(await changePasswordAction(null, change())).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect((await signIn(ADMIN_PASSWORD)).status).toBe(200);
    });

    it('refuses in demo mode before it asks the auth layer', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      expect(await changePasswordAction(null, change())).toMatchObject({ status: 'error', code: 'demo' });
      vi.unstubAllEnvs();
      expect((await signIn(ADMIN_PASSWORD)).status).toBe(200);
    });
  });

  describe('changeEmailAction while email is off', () => {
    it('says that outgoing email is needed and changes nothing', async () => {
      const result = await changeEmailAction(null, form({ email: 'new@example.com', locale: 'en' }));
      expect(result).toEqual({ status: 'error', code: 'emailOff', fields: {} });
      expect((await getDb().user.findFirstOrThrow()).email).toBe(ADMIN_EMAIL);
    });

    it('refuses a visitor without a session and the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      expect(await changeEmailAction(null, form({ email: 'new@example.com' }))).toMatchObject({ code: 'demo' });
      vi.unstubAllEnvs();
      visitor();
      expect(await changeEmailAction(null, form({ email: 'new@example.com' }))).toMatchObject({
        code: 'unauthorized',
      });
    });
  });
});
