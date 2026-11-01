// @vitest-environment node
import { after } from 'next/server';
import { createTransport } from 'nodemailer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EmailDisabledError,
  sendEmail,
  sendEmailAfterResponse,
  setEmailScheduler,
  setEmailTransport,
} from './index.ts';

// Whatever options it gets, the transport only builds JSON and never opens a connection.
vi.mock('nodemailer', async (importOriginal) => {
  const original = await importOriginal<typeof import('nodemailer')>();
  return { ...original, createTransport: vi.fn(() => original.createTransport({ jsonTransport: true })) };
});

// `after` only works inside a request; here it is a spy, so the default scheduler can be observed.
vi.mock('next/server', () => ({ after: vi.fn() }));

const smtp = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'mailer-password',
  SMTP_FROM: 'Tanyeri <no-reply@example.com>',
};
const message = { to: 'admin@example.com', subject: 'Hello', text: 'Plain text body' };

function stubSmtp(overrides: Record<string, string> = {}): void {
  for (const [name, value] of Object.entries({ ...smtp, ...overrides })) vi.stubEnv(name, value);
}

beforeEach(() => {
  vi.mocked(createTransport).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  setEmailTransport(undefined);
  setEmailScheduler(undefined);
});

describe('sendEmail', () => {
  it('sends the message from the configured address through the transport', async () => {
    stubSmtp();
    const transport = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    setEmailTransport(transport);

    await sendEmail(message);

    expect(sendMail).toHaveBeenCalledWith({ from: smtp.SMTP_FROM, ...message });
    const info = (await sendMail.mock.results[0]!.value) as { message: string };
    expect(JSON.parse(info.message)).toMatchObject({ subject: 'Hello', text: 'Plain text body' });
  });

  it('refuses to send while email is off and creates no transport', async () => {
    vi.mocked(createTransport).mockClear();
    await expect(sendEmail(message)).rejects.toBeInstanceOf(EmailDisabledError);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('creates the transport from the SMTP variables on first use only', async () => {
    stubSmtp();
    expect(createTransport).not.toHaveBeenCalled();

    await sendEmail(message);
    await sendEmail(message);

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'mailer', pass: 'mailer-password' },
    });
  });

  it('uses TLS from the first byte on port 465 only', async () => {
    stubSmtp({ SMTP_PORT: '465' });
    await sendEmail(message);
    expect(vi.mocked(createTransport).mock.calls[0]![0]).toMatchObject({ port: 465, secure: true });
  });
});

describe('sendEmailAfterResponse', () => {
  it('hands the work to the scheduler and sends nothing until it runs', async () => {
    stubSmtp();
    const transport = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    setEmailTransport(transport);
    const tasks: (() => Promise<void>)[] = [];
    setEmailScheduler((task) => tasks.push(task));

    sendEmailAfterResponse(message);

    expect(tasks).toHaveLength(1);
    expect(sendMail).not.toHaveBeenCalled();
    await tasks[0]!();
    expect(sendMail).toHaveBeenCalledWith({ from: smtp.SMTP_FROM, ...message });
  });

  it('uses the after() of Next.js unless a scheduler is set', () => {
    sendEmailAfterResponse(message);
    expect(after).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledWith(expect.any(Function));
  });

  it('logs the kind of a failure, never the address or the message, and does not throw', async () => {
    stubSmtp();
    const transport = createTransport({ jsonTransport: true });
    const failure = Object.assign(new Error('550 admin@example.com rejected, token=abc123'), { code: 'EENVELOPE' });
    vi.spyOn(transport, 'sendMail').mockRejectedValueOnce(failure);
    setEmailTransport(transport);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tasks: (() => Promise<void>)[] = [];
    setEmailScheduler((task) => tasks.push(task));

    sendEmailAfterResponse(message);
    await expect(tasks[0]!()).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('Sending an email failed', { name: 'Error', code: 'EENVELOPE' });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/admin@example\.com|abc123/);
    log.mockRestore();
  });

  it('logs a failure while email is off the same way', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const tasks: (() => Promise<void>)[] = [];
    setEmailScheduler((task) => tasks.push(task));

    sendEmailAfterResponse(message);
    await tasks[0]!();

    expect(log).toHaveBeenCalledWith('Sending an email failed', { name: 'EmailDisabledError', code: undefined });
    log.mockRestore();
  });
});
