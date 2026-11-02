import { createTransport } from 'nodemailer';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_EMAIL as EMAIL,
  ADMIN_PASSWORD as PASSWORD,
  OTHER_PASSWORD,
  authRequest,
  cookieOf,
  handle,
  loginCookie,
  resetAdmin,
  sessionOf,
  signIn,
} from '../../test/auth-http.ts';
import { TEST_AUTH_URL } from '../../test/integration-env.ts';
import { getDb } from '../db.ts';
import { setEmailTransport } from '../email/index.ts';

// These tests run without the SMTP variables: email is off. The enabled side is in password-reset.int.test.ts.
describe('authentication endpoints on a real database', () => {
  beforeEach(async () => {
    await resetAdmin();
  });

  afterEach(() => {
    setEmailTransport(undefined);
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('signs in with the right password from the site origin', async () => {
    const response = await signIn(PASSWORD);
    expect(response.status).toBe(200);
    expect(cookieOf(response)).toContain('session_token=');
    expect(await getDb().session.count()).toBe(1);
  });

  it('answers the session lookup of a visitor without a session', async () => {
    const response = await handle(new Request(`${TEST_AUTH_URL}/api/auth/get-session`));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it('keeps sign-up closed', async () => {
    const response = await handle(
      authRequest('/sign-up/email', {
        name: 'Intruder',
        email: 'intruder@example.com',
        password: 'a long enough password',
      }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(await getDb().user.count({ where: { email: 'intruder@example.com' } })).toBe(0);
    expect(await getDb().user.count()).toBe(1);
  });

  it('rejects a wrong password and creates no session', async () => {
    const response = await signIn('not the password');
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await getDb().session.count()).toBe(0);
  });

  it('allows three sign-in attempts per address, then answers 429 even for the right password', async () => {
    const address = '198.51.100.7';
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await signIn('wrong password', { address })).status).toBe(401);
    }
    const limited = await signIn('wrong password', { address });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('x-retry-after'))).toBeGreaterThan(0);
    expect(Number(limited.headers.get('x-retry-after'))).toBeLessThanOrEqual(10);

    const rightPassword = await signIn(PASSWORD, { address });
    expect(rightPassword.status).toBe(429);
    expect(await getDb().session.count()).toBe(0);

    // The budget belongs to the address: another visitor is not locked out.
    expect((await signIn(PASSWORD, { address: '198.51.100.8' })).status).toBe(200);
  });

  it('never lets concurrent sign-in attempts past the limit', async () => {
    const address = '198.51.100.20';
    const responses = await Promise.all(Array.from({ length: 20 }, () => signIn('wrong password', { address })));
    const statuses = responses.map((response) => response.status);

    expect(statuses.filter((status) => status === 401)).toHaveLength(3);
    expect(statuses.filter((status) => status === 429)).toHaveLength(17);
    const rows = await getDb().rateLimit.findMany({ where: { key: { contains: address } } });
    expect(rows.map((row) => row.count)).toEqual([3]);
  });

  it('rejects a sign-in from an untrusted origin and creates no session', async () => {
    const response = await signIn(PASSWORD, { origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await getDb().session.count()).toBe(0);
  });

  it('rejects a request that carries a session cookie from an untrusted origin', async () => {
    const cookie = await loginCookie();
    const response = await handle(
      authRequest(
        '/change-password',
        { currentPassword: PASSWORD, newPassword: OTHER_PASSWORD },
        { cookie, origin: 'https://evil.example' },
      ),
    );
    expect(response.status).toBe(403);
    expect((await signIn(PASSWORD)).status).toBe(200);
  });

  it('ends every session when the password is changed with revokeOtherSessions', async () => {
    const first = await loginCookie();
    const second = await loginCookie();
    expect(await sessionOf(first)).not.toBeNull();
    expect(await sessionOf(second)).not.toBeNull();

    const changed = await handle(
      authRequest(
        '/change-password',
        { currentPassword: PASSWORD, newPassword: OTHER_PASSWORD, revokeOtherSessions: true },
        { cookie: first },
      ),
    );
    expect(changed.status).toBe(200);

    // A revoked session stops working at once: the session cookie is never trusted without the database.
    expect(await sessionOf(first)).toBeNull();
    expect(await sessionOf(second)).toBeNull();
    expect(await sessionOf(cookieOf(changed))).not.toBeNull();
    expect(await getDb().session.count()).toBe(1);

    expect((await signIn(PASSWORD)).status).toBe(401);
    expect((await signIn(OTHER_PASSWORD)).status).toBe(200);
  });

  it('refuses a password reset request while email is off, and sends and stores nothing', async () => {
    const transport = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    setEmailTransport(transport);

    const response = await handle(authRequest('/request-password-reset', { email: EMAIL }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'RESET_PASSWORD_DISABLED' });
    expect(sendMail).not.toHaveBeenCalled();
    expect(await getDb().verification.count()).toBe(0);
    expect((await signIn(PASSWORD)).status).toBe(200);
  });
});
