import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPasswordResetAvailable } from './reset-available.ts';

const SMTP = {
  SMTP_HOST: 'mail.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'sender',
  SMTP_PASSWORD: 'x'.repeat(12),
  SMTP_FROM: 'noreply@example.com',
};

function stub(values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

describe('isPasswordResetAvailable', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is on with outgoing email and no demo mode', () => {
    stub({ ...SMTP, DEMO_MODE: 'false' });
    expect(isPasswordResetAvailable()).toBe(true);
  });

  it('is off without outgoing email', () => {
    stub({ SMTP_HOST: '', SMTP_PORT: '', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_FROM: '', DEMO_MODE: 'false' });
    expect(isPasswordResetAvailable()).toBe(false);
  });

  it('is off in demo mode even with outgoing email', () => {
    stub({ ...SMTP, DEMO_MODE: 'true' });
    expect(isPasswordResetAvailable()).toBe(false);
  });
});
