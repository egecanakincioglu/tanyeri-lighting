import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/auth/[...all]/route.ts';
import { ADMIN_EMAIL, authRequest } from '../../test/auth-http.ts';
import { getDb } from '../db.ts';

// A half-set group is a deployment mistake: the auth routes fail loudly instead of quietly running without email.
describe('a partial SMTP group', () => {
  beforeAll(() => {
    vi.stubEnv('SMTP_HOST', 'smtp.example.com');
    vi.stubEnv('SMTP_PASSWORD', 'mailer-password-7f3a');
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await getDb().$disconnect();
  });

  it('fails the auth routes with an error that names the missing variables and no value', async () => {
    let message = '';
    try {
      await POST(authRequest('/request-password-reset', { email: ADMIN_EMAIL }));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/SMTP_PORT[\s\S]*SMTP_USER[\s\S]*SMTP_FROM/);
    expect(message).not.toContain('7f3a');
  });
});
