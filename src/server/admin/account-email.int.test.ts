import { createTransport } from 'nodemailer';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { GET } from '../../app/api/auth/[...all]/route.ts';
import { ADMIN_EMAIL, loginCookie, resetAdmin } from '../../test/auth-http.ts';
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

// These tests run with the SMTP variables set: email is on. The off side is in account-actions.int.test.ts.
describe('changeEmailAction with email on', () => {
  let cookie = '';

  beforeAll(() => {
    for (const [name, value] of Object.entries(SMTP)) vi.stubEnv(name, value);
    const transport = createTransport({ jsonTransport: true });
    sendMail = vi.spyOn(transport, 'sendMail') as unknown as typeof sendMail;
    setEmailTransport(transport);
    // The mail goes out after the response; here it goes at once.
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

  it('sends the confirmation link to the new address, and the address changes only when the link is opened', async () => {
    const result = await changeEmailAction(null, form({ email: 'New@Example.com', locale: 'en' }));
    expect(result).toEqual({ status: 'success' });
    expect((await getDb().user.findFirstOrThrow()).email).toBe(ADMIN_EMAIL);

    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(1));
    const mail = sendMail.mock.calls[0]![0];
    expect(mail.to).toBe('new@example.com');
    const link = new URL(/https?:\/\/\S+/.exec(mail.text)![0]);
    expect(link.pathname).toBe('/api/auth/verify-email');
    expect(link.searchParams.get('callbackURL')).toBe('/en/admin/account');

    const opened = await GET(new Request(link, { headers: { cookie } }));
    expect(opened.status).toBe(302);
    expect(opened.headers.get('location')).toBe('/en/admin/account');
    expect(new URL(link).origin).toBe(TEST_AUTH_URL);
    expect((await getDb().user.findFirstOrThrow()).email).toBe('new@example.com');
  });

  it('gives a field error for an empty, malformed or unchanged address, and sends nothing', async () => {
    const fields = async (email: string) => {
      const result = await changeEmailAction(null, form({ email }));
      return result.status === 'error' ? result.fields : result;
    };
    expect(await fields('')).toEqual({ email: 'required' });
    expect(await fields('not-an-address')).toEqual({ email: 'invalid' });
    expect(await fields(ADMIN_EMAIL.toUpperCase())).toEqual({ email: 'same' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('applies the limit of the auth layer to repeated requests from one address', async () => {
    const address = '203.0.113.250';
    const codes = [];
    for (let i = 0; i < 5; i++) {
      request.headers = new Headers({ 'x-forwarded-for': address, cookie });
      const result = await changeEmailAction(null, form({ email: `other${i}@example.com` }));
      codes.push(result.status === 'error' ? result.code : result.status);
    }
    expect(codes).toContain('rateLimited');
    expect(codes[0]).toBe('success');
  });
});
