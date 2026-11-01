// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildAuthOptions } from './auth.ts';

const settings = {
  secret: 'a-secret-of-at-least-thirty-two-characters',
  baseURL: 'https://tanyeri.example.com',
  production: true,
};

describe('buildAuthOptions', () => {
  it('writes out every setting ADR 0003 requires', () => {
    const options = buildAuthOptions(settings);
    expect(options.emailAndPassword).toEqual({
      enabled: true,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
    });
    expect(options.rateLimit).toEqual({ enabled: true, storage: 'database' });
    expect(options.session).toEqual({ cookieCache: { enabled: false } });
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
