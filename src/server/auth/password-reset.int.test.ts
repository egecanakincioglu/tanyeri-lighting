import { createTransport } from 'nodemailer';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';
import { POST } from '../../app/api/auth/[...all]/route.ts';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OTHER_PASSWORD,
  authRequest,
  loginCookie,
  resetAdmin,
  sessionOf,
  signIn,
} from '../../test/auth-http.ts';
import { TEST_AUTH_URL } from '../../test/integration-env.ts';
import { getDb } from '../db.ts';
import { setEmailScheduler, setEmailTransport } from '../email/index.ts';

const SMTP = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'mailer-password',
  SMTP_FROM: 'Tanyeri <no-reply@example.com>',
};

type SentMail = { from: string; to: string; subject: string; text: string };

let sendMail: MockInstance<(mail: SentMail) => Promise<unknown>>;

// The email goes out after the response; the scheduler keeps the tasks so a test decides when they run.
let scheduled: (() => Promise<void>)[] = [];

async function runScheduled(): Promise<void> {
  const tasks = scheduled;
  scheduled = [];
  for (const task of tasks) await task();
}

function requestReset(email: string, address?: string): Promise<Response> {
  return POST(authRequest('/request-password-reset', { email }, { address }));
}

function resetPassword(token: string, newPassword: string, address?: string): Promise<Response> {
  return POST(authRequest('/reset-password', { token, newPassword }, { address }));
}

function sentMail(index = 0): SentMail {
  return sendMail.mock.calls[index]![0];
}

function tokenOf(mail: SentMail): string {
  const token = new URL(/https?:\/\/\S+/.exec(mail.text)![0]).searchParams.get('token');
  expect(token).toBeTruthy();
  return token!;
}

// These tests run with the SMTP variables set: email is on. The disabled side is in auth.int.test.ts.
describe('password reset with email on', () => {
  beforeAll(() => {
    for (const [name, value] of Object.entries(SMTP)) vi.stubEnv(name, value);
    // One of nodemailer's built-in transports: it builds the message and sends nothing over a network.
    const transport = createTransport({ jsonTransport: true });
    sendMail = vi.spyOn(transport, 'sendMail') as unknown as typeof sendMail;
    setEmailTransport(transport);
    setEmailScheduler((task) => scheduled.push(task));
  });

  beforeEach(async () => {
    sendMail.mockReset();
    scheduled = [];
    await resetAdmin();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    setEmailTransport(undefined);
    setEmailScheduler(undefined);
    await getDb().$disconnect();
  });

  it('emails one working link, and using it signs out every session and replaces the password', async () => {
    const first = await loginCookie();
    const second = await loginCookie();
    expect(await sessionOf(first)).not.toBeNull();
    expect(await sessionOf(second)).not.toBeNull();

    const requested = await requestReset(ADMIN_EMAIL);
    expect(requested.status).toBe(200);
    await runScheduled();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const mail = sentMail();
    expect(mail.to).toBe(ADMIN_EMAIL);
    expect(mail.from).toBe(SMTP.SMTP_FROM);
    expect(mail.text).toContain(`${TEST_AUTH_URL}/tr/dashboard/reset-password?token=`);
    const token = tokenOf(mail);

    const reset = await resetPassword(token, OTHER_PASSWORD);
    expect(reset.status).toBe(200);

    expect(await sessionOf(first)).toBeNull();
    expect(await sessionOf(second)).toBeNull();
    expect(await getDb().session.count()).toBe(0);
    expect((await signIn(ADMIN_PASSWORD)).status).toBe(401);
    expect((await signIn(OTHER_PASSWORD)).status).toBe(200);
  });

  it('sends the email after the response, not before', async () => {
    const response = await requestReset(ADMIN_EMAIL);
    expect(response.status).toBe(200);
    expect(scheduled).toHaveLength(1);
    expect(sendMail).not.toHaveBeenCalled();
    await runScheduled();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('accepts a reset link once only', async () => {
    await requestReset(ADMIN_EMAIL);
    await runScheduled();
    const token = tokenOf(sentMail());

    expect((await resetPassword(token, OTHER_PASSWORD)).status).toBe(200);
    expect((await resetPassword(token, 'a third long passphrase 7')).status).toBe(400);
    expect((await signIn(OTHER_PASSWORD)).status).toBe(200);
  });

  it('rejects a made-up token and keeps the password', async () => {
    const response = await resetPassword('not-a-real-token', OTHER_PASSWORD);
    expect(response.status).toBe(400);
    expect((await signIn(ADMIN_PASSWORD)).status).toBe(200);
  });

  it('answers an unknown address exactly like a known one, and sends nothing', async () => {
    const known = await requestReset(ADMIN_EMAIL);
    const unknown = await requestReset('nobody@example.com');

    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(scheduled).toHaveLength(1);
    await runScheduled();
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sentMail().to).toBe(ADMIN_EMAIL);
    expect(await getDb().verification.count()).toBe(1);
  });

  it('answers the same when the mail server fails, and logs only the kind of failure', async () => {
    const ok = await requestReset('nobody@example.com');
    sendMail.mockRejectedValueOnce(Object.assign(new Error(`550 ${ADMIN_EMAIL} rejected`), { code: 'EENVELOPE' }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const failed = await requestReset(ADMIN_EMAIL);
    await runScheduled();

    expect(failed.status).toBe(ok.status);
    expect(await failed.json()).toEqual(await ok.json());
    expect(log).toHaveBeenCalledWith('Sending an email failed', { name: 'Error', code: 'EENVELOPE' });
    expect(JSON.stringify(log.mock.calls)).not.toContain(ADMIN_EMAIL);
    log.mockRestore();
  });

  it('allows three reset requests per address per minute, then answers 429 and sends no fourth email', async () => {
    const address = '198.51.100.30';
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await requestReset(ADMIN_EMAIL, address)).status).toBe(200);
    }
    const limited = await requestReset(ADMIN_EMAIL, address);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('x-retry-after'))).toBeGreaterThan(0);
    expect(Number(limited.headers.get('x-retry-after'))).toBeLessThanOrEqual(60);
    await runScheduled();
    expect(sendMail).toHaveBeenCalledTimes(3);

    // The budget belongs to the address: another visitor is not limited.
    expect((await requestReset(ADMIN_EMAIL, '198.51.100.31')).status).toBe(200);
  });

  it('allows five reset attempts per address per minute, then answers 429 even for a valid token', async () => {
    const address = '198.51.100.40';
    for (let attempt = 1; attempt <= 5; attempt++) {
      expect((await resetPassword('guessed-token', OTHER_PASSWORD, address)).status).toBe(400);
    }
    const limited = await resetPassword('guessed-token', OTHER_PASSWORD, address);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('x-retry-after'))).toBeGreaterThan(0);
    expect(Number(limited.headers.get('x-retry-after'))).toBeLessThanOrEqual(60);

    await requestReset(ADMIN_EMAIL, '198.51.100.41');
    await runScheduled();
    const token = tokenOf(sentMail());
    expect((await resetPassword(token, OTHER_PASSWORD, address)).status).toBe(429);
    expect((await signIn(ADMIN_PASSWORD)).status).toBe(200);
    expect((await resetPassword(token, OTHER_PASSWORD, '198.51.100.42')).status).toBe(200);
  });
});
