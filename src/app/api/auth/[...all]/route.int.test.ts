import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_EMAIL, ADMIN_PASSWORD, authRequest, resetAdmin } from '../../../../test/auth-http.ts';
import { TEST_AUTH_URL } from '../../../../test/integration-env.ts';
import { getDb } from '../../../../server/db.ts';
import { GET, POST } from './route.ts';

function get(path: string): Promise<Response> {
  return GET(new Request(`${TEST_AUTH_URL}/api/auth${path}`, { headers: { 'x-forwarded-for': '192.0.2.77' } }));
}

describe('the auth route on a real database', () => {
  beforeEach(resetAdmin);

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('answers 404 for paths nobody uses and writes no rate limit row, whatever the path', async () => {
    const answers = [
      await get('/random-1'),
      await get('/random-2/deeper'),
      await POST(authRequest('/random-3', {})),
      await POST(authRequest('/random-4', {})),
    ];

    expect(answers.map((answer) => answer.status)).toEqual([404, 404, 404, 404]);
    expect(await getDb().rateLimit.count()).toBe(0);
  });

  it('keeps the endpoints the server calls itself away from the browser, and counts nothing for them', async () => {
    const signIn = await POST(authRequest('/sign-in/email', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
    const signOut = await POST(authRequest('/sign-out', {}));
    const session = await get('/get-session');
    const sessions = await get('/list-sessions');

    expect([signIn.status, signOut.status, session.status, sessions.status]).toEqual([404, 404, 404, 404]);
    expect(signIn.headers.getSetCookie()).toEqual([]);
    expect(await getDb().session.count()).toBe(0);
    expect(await getDb().rateLimit.count()).toBe(0);
  });

  it('answers 404 for an allowed path with the wrong method', async () => {
    expect((await get('/request-password-reset')).status).toBe(404);
    expect((await POST(authRequest('/verify-email', {}))).status).toBe(404);
    expect(await getDb().rateLimit.count()).toBe(0);
  });

  it('passes the password reset requests to the library, which limits them', async () => {
    const reset = await POST(authRequest('/request-password-reset', { email: ADMIN_EMAIL }));
    const attempt = await POST(authRequest('/reset-password', { token: 'x', newPassword: 'x'.repeat(12) }));

    // Email is off in this suite: the library refuses the request itself, so it did run.
    expect(reset.status).toBe(400);
    expect(attempt.status).toBe(400);
    expect(await getDb().rateLimit.count()).toBe(2);
  });

  it('passes the link of the change-email mail to the library', async () => {
    const opened = await get('/verify-email?token=not-a-token');
    expect(opened.status).toBe(401);
    expect(await getDb().rateLimit.count()).toBe(1);
  });
});
