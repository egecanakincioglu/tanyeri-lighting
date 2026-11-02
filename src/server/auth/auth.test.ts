// @vitest-environment node
import { createTransport } from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setEmailScheduler, setEmailTransport } from '../email/index.ts';
import { buildAuthOptions } from './auth.ts';

const limiter = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock('../rate-limit/index.ts', () => ({ checkRateLimit: limiter.check }));

const settings = {
  secret: 'a-secret-of-at-least-thirty-two-characters',
  baseURL: 'https://tanyeri.example.com',
  production: true,
  emailEnabled: false,
};

describe('buildAuthOptions', () => {
  it('writes out every setting ADR 0003 requires', () => {
    const options = buildAuthOptions(settings);
    expect(options.emailAndPassword).toEqual({
      enabled: true,
      minPasswordLength: 12,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
    });
    expect(options.rateLimit.enabled).toBe(true);
    expect(options.rateLimit.storage).toBe('database');
    expect(options.session).toEqual({ cookieCache: { enabled: false } });
  });

  it('fixes the limits of the sign-in and password reset endpoints (ADR 0004 rule 1)', () => {
    expect(buildAuthOptions(settings).rateLimit.customRules).toEqual({
      '/sign-in/email': { window: 10, max: 3 },
      '/request-password-reset': { window: 60, max: 3 },
      '/reset-password': { window: 60, max: 5 },
    });
  });

  it('keeps the origin and CSRF checks on explicitly', () => {
    const { advanced } = buildAuthOptions(settings);
    expect(advanced.disableOriginCheck).toBe(false);
    expect(advanced.disableCSRFCheck).toBe(false);
  });

  it('forces secure cookies in production only', () => {
    expect(buildAuthOptions(settings).advanced.useSecureCookies).toBe(true);
    expect(buildAuthOptions({ ...settings, production: false }).advanced.useSecureCookies).toBe(false);
  });

  it('trusts only the origin of the site address', () => {
    expect(buildAuthOptions(settings).trustedOrigins).toEqual(['https://tanyeri.example.com']);
    expect(buildAuthOptions({ ...settings, baseURL: 'https://tanyeri.example.com/some/path' }).trustedOrigins).toEqual([
      'https://tanyeri.example.com',
    ]);
  });

  it('passes the secret and the address through', () => {
    const options = buildAuthOptions(settings);
    expect(options.secret).toBe(settings.secret);
    expect(options.baseURL).toBe(settings.baseURL);
  });
});

describe('password reset email', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setEmailTransport(undefined);
    setEmailScheduler(undefined);
  });

  it('has no sender while email is off, so the library refuses reset requests', () => {
    expect(buildAuthOptions(settings).emailAndPassword).not.toHaveProperty('sendResetPassword');
  });

  it('schedules the reset link for after the response while email is on', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'mailer');
    vi.stubEnv('SMTP_PASSWORD', 'mailer-password');
    vi.stubEnv('SMTP_FROM', 'Tanyeri <no-reply@example.com>');
    const transport = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    setEmailTransport(transport);
    const tasks: (() => Promise<void>)[] = [];
    setEmailScheduler((task) => tasks.push(task));

    limiter.check.mockResolvedValue({ ok: true });
    const { emailAndPassword } = buildAuthOptions({ ...settings, emailEnabled: true });
    await emailAndPassword.sendResetPassword!({ user: { id: 'user-1', email: 'admin@example.com' }, token: 'abc123' });

    expect(tasks).toHaveLength(1);
    expect(sendMail).not.toHaveBeenCalled();
    await tasks[0]!();
    expect(sendMail).toHaveBeenCalledTimes(1);
    const sent = sendMail.mock.calls[0]![0];
    expect(sent.to).toBe('admin@example.com');
    expect(sent.from).toBe('Tanyeri <no-reply@example.com>');
    expect(sent.text).toContain('https://tanyeri.example.com/tr/yonetim/parola-sifirla?token=abc123');
    expect(limiter.check).toHaveBeenCalledWith({
      scope: 'reset-mail',
      limit: 3,
      windowSeconds: 3600,
      subject: 'user-1',
    });
  });

  it('drops the mail without a sign when the account has used its three mails of the hour', async () => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'mailer');
    vi.stubEnv('SMTP_PASSWORD', 'mailer-password');
    vi.stubEnv('SMTP_FROM', 'Tanyeri <no-reply@example.com>');
    const transport = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    setEmailTransport(transport);
    const tasks: (() => Promise<void>)[] = [];
    setEmailScheduler((task) => tasks.push(task));
    limiter.check.mockResolvedValue({ ok: false, retryAfterSeconds: 60 });

    const { emailAndPassword } = buildAuthOptions({ ...settings, emailEnabled: true });
    await expect(
      emailAndPassword.sendResetPassword!({ user: { id: 'user-1', email: 'admin@example.com' }, token: 'abc123' }),
    ).resolves.toBeUndefined();
    await tasks[0]!();

    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('changing the sign-in email', () => {
  afterEach(() => {
    setEmailTransport(undefined);
    setEmailScheduler(undefined);
  });

  it('is off while email is off, because there is no link to send', () => {
    const options = buildAuthOptions(settings);
    expect(options.user.changeEmail.enabled).toBe(false);
    expect(options).not.toHaveProperty('emailVerification');
  });

  it('is on with email, with a one hour link sent to the new address after the response', async () => {
    const transport = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    setEmailTransport(transport);
    const tasks: (() => Promise<void>)[] = [];
    setEmailScheduler((task) => tasks.push(task));
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'mailer');
    vi.stubEnv('SMTP_PASSWORD', 'mailer-password');
    vi.stubEnv('SMTP_FROM', 'Tanyeri <no-reply@example.com>');

    const options = buildAuthOptions({ ...settings, emailEnabled: true });
    expect(options.user.changeEmail.enabled).toBe(true);
    expect(options.emailVerification!.expiresIn).toBe(3600);
    await options.emailVerification!.sendVerificationEmail({
      user: { email: 'new@example.com' },
      url: 'https://tanyeri.example.com/api/auth/verify-email?token=abc',
    });
    expect(sendMail).not.toHaveBeenCalled();
    await tasks[0]!();
    expect(sendMail.mock.calls[0]![0]).toMatchObject({ to: 'new@example.com' });
    expect(sendMail.mock.calls[0]![0].text).toContain('verify-email?token=abc');
    vi.unstubAllEnvs();
  });

  it('asks the current address to approve first, naming the new address', async () => {
    const transport = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transport, 'sendMail');
    setEmailTransport(transport);
    const tasks: (() => Promise<void>)[] = [];
    setEmailScheduler((task) => tasks.push(task));
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'mailer');
    vi.stubEnv('SMTP_PASSWORD', 'mailer-password');
    vi.stubEnv('SMTP_FROM', 'Tanyeri <no-reply@example.com>');

    const { changeEmail } = buildAuthOptions({ ...settings, emailEnabled: true }).user;
    await changeEmail.sendChangeEmailConfirmation!({
      user: { email: 'admin@example.com' },
      newEmail: 'new@example.com',
      url: 'https://tanyeri.example.com/api/auth/verify-email?token=abc',
    });
    await tasks[0]!();

    const sent = sendMail.mock.calls[0]![0];
    expect(sent.to).toBe('admin@example.com');
    expect(sent.text).toContain('new@example.com');
    expect(sent.text).toContain('verify-email?token=abc');
    vi.unstubAllEnvs();
  });

  it('has no approval step while email is off, because the change is off', () => {
    expect(buildAuthOptions(settings).user.changeEmail).toEqual({ enabled: false });
  });
});
