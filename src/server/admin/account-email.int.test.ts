import { createTransport } from 'nodemailer';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { GET } from '../../app/api/auth/[...all]/route.ts';
import { ADMIN_EMAIL, ADMIN_PASSWORD, cookieOf, loginCookie, resetAdmin, sessionOf } from '../../test/auth-http.ts';
import { TEST_AUTH_URL } from '../../test/integration-env.ts';
import { getDb } from '../db.ts';
import { setEmailScheduler, setEmailTransport } from '../email/index.ts';
import { changeEmailAction } from './account-actions.ts';

const request = vi.hoisted(() => ({ headers: new Headers(), cookieSet: vi.fn() }));
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve(request.headers),
  cookies: () => Promise.resolve({ set: request.cookieSet }),
}));

const SMTP = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'mailer-password',
  SMTP_FROM: 'Tanyeri <no-reply@example.com>',
};

type SentMail = { from: string; to: string; subject: string; text: string };
let sendMail: MockInstance<(mail: SentMail) => Promise<unknown>>;

let nextAddress = 1;
function visitor(cookie: string): void {
  request.headers = new Headers({ 'x-forwarded-for': `198.51.100.${nextAddress++}`, cookie });
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('changeEmailAction with email on', () => {
  let cookie = '';

  beforeAll(() => {
    for (const [name, value] of Object.entries(SMTP)) vi.stubEnv(name, value);
    const transport = createTransport({ jsonTransport: true });
    sendMail = vi.spyOn(transport, 'sendMail') as unknown as typeof sendMail;
    setEmailTransport(transport);
    // The mail normally goes out after the response; here it goes at once.
    setEmailScheduler((task) => void task());
  });

  beforeEach(async () => {
    sendMail.mockReset();
    await resetAdmin();
    cookie = await loginCookie({ address: `192.0.2.${nextAddress}` });
    visitor(cookie);
  });

  afterAll(async () => {
    setEmailTransport(undefined);
    setEmailScheduler(undefined);
    vi.unstubAllEnvs();
    await getDb().$disconnect();
  });

  function linkOf(mail: SentMail): URL {
    const link = new URL(/https?:\/\/\S+/.exec(mail.text)![0]);
    expect(link.pathname).toBe('/api/auth/verify-email');
    expect(link.searchParams.get('callbackURL')).toBe('/en/admin/account');
    expect(link.origin).toBe(TEST_AUTH_URL);
    return link;
  }

  it('asks the current address first, then the new one; the address changes at the last link only', async () => {
    const result = await changeEmailAction(
      null,
      form({ currentPassword: ADMIN_PASSWORD, email: 'New@Example.com', locale: 'en' }),
    );
    expect(result).toEqual({ status: 'success' });
    expect((await getDb().user.findFirstOrThrow()).email).toBe(ADMIN_EMAIL);

    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(1));
    const approval = sendMail.mock.calls[0]![0];
    expect(approval.to).toBe(ADMIN_EMAIL);
    expect(approval.text).toContain('new@example.com');

    const approved = await GET(new Request(linkOf(approval), { headers: { cookie } }));
    expect(approved.status).toBe(302);
    expect((await getDb().user.findFirstOrThrow()).email).toBe(ADMIN_EMAIL);
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(2));
    const confirmation = sendMail.mock.calls[1]![0];
    expect(confirmation.to).toBe('new@example.com');

    // This user has no session of their own: the link signs them in, then the change ends every session.
    const opened = await GET(new Request(linkOf(confirmation)));
    expect(opened.status).toBe(302);
    expect(opened.headers.get('location')).toBe('/en/admin/account');
    expect((await getDb().user.findFirstOrThrow()).email).toBe('new@example.com');
    expect(await getDb().session.count()).toBe(0);
    expect(await sessionOf(cookie)).toBeNull();
    expect(await sessionOf(cookieOf(opened))).toBeNull();
  });

  it('does not change the address when only the new address link is used without the approval', async () => {
    await changeEmailAction(null, form({ currentPassword: ADMIN_PASSWORD, email: 'new@example.com', locale: 'en' }));
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(1));
    const approval = linkOf(sendMail.mock.calls[0]![0]);
    const forged = new URL(approval);
    forged.searchParams.set('token', 'not-a-token');

    const opened = await GET(new Request(forged, { headers: { cookie } }));

    expect(opened.headers.get('location')).toContain('error=');
    expect((await getDb().user.findFirstOrThrow()).email).toBe(ADMIN_EMAIL);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('gives a field error for an empty, malformed or unchanged address, and sends nothing', async () => {
    const fields = async (email: string) => {
      const result = await changeEmailAction(null, form({ currentPassword: ADMIN_PASSWORD, email }));
      return result.status === 'error' ? result.fields : result;
    };
    expect(await fields('')).toEqual({ email: 'required' });
    expect(await fields('not-an-address')).toEqual({ email: 'invalid' });
    expect(await fields(ADMIN_EMAIL.toUpperCase())).toEqual({ email: 'same' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('asks for the current password and sends nothing without the right one', async () => {
    const result = (password: string) =>
      changeEmailAction(null, form({ currentPassword: password, email: 'new@example.com', locale: 'en' }));
    expect(await result('')).toEqual({ status: 'error', code: 'invalid', fields: { currentPassword: 'required' } });
    expect(await result('not the password')).toEqual({
      status: 'error',
      code: 'invalid',
      fields: { currentPassword: 'wrongCurrent' },
    });
    expect(sendMail).not.toHaveBeenCalled();
    expect(await result(ADMIN_PASSWORD)).toEqual({ status: 'success' });
  });

  it('counts the password guesses per account, whatever the address', async () => {
    const guess = () =>
      changeEmailAction(null, form({ currentPassword: 'not the password', email: 'new@example.com' }));
    const codes = [];
    for (let i = 0; i < 6; i++) {
      visitor(cookie);
      const result = await guess();
      codes.push(result.status === 'error' ? result.code : result.status);
    }
    expect(codes.slice(0, 5)).toEqual(Array(5).fill('invalid'));
    expect(codes[5]).toBe('rateLimited');
    visitor(cookie);
    const right = await changeEmailAction(null, form({ currentPassword: ADMIN_PASSWORD, email: 'new@example.com' }));
    expect(right).toMatchObject({ status: 'error', code: 'rateLimited' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('applies the limit of the auth layer to repeated requests from one address', async () => {
    const address = '203.0.113.250';
    const codes = [];
    for (let i = 0; i < 5; i++) {
      request.headers = new Headers({ 'x-forwarded-for': address, cookie });
      const result = await changeEmailAction(
        null,
        form({ currentPassword: ADMIN_PASSWORD, email: `other${i}@example.com` }),
      );
      codes.push(result.status === 'error' ? result.code : result.status);
    }
    expect(codes).toContain('rateLimited');
    expect(codes[0]).toBe('success');
  });
});
