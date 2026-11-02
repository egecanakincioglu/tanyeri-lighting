// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminCredentials,
  getDemoAdminCredentials,
  getBlobToken,
  getEnv,
  getSiteUrl,
  getSmtpConfig,
  isDemoMode,
  isDevelopment,
  isEmailEnabled,
  isIndexingEnabled,
  isProduction,
  isVercel,
  parseEnv,
} from './env.ts';

const valid = {
  DATABASE_URL: 'postgresql://pool.example.com:5432/tanyeri',
  DATABASE_URL_UNPOOLED: 'postgres://db.example.com:5432/tanyeri',
  BETTER_AUTH_SECRET: 'a-secret-of-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'https://tanyeri.example.com',
};

describe('parseEnv', () => {
  it('accepts both postgres schemes', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('rejects a missing variable and names it', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL_UNPOOLED: undefined })).toThrow(/DATABASE_URL_UNPOOLED/);
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: undefined })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => parseEnv({ ...valid, BETTER_AUTH_URL: undefined })).toThrow(/BETTER_AUTH_URL/);
  });

  it('rejects an auth secret shorter than 32 characters', () => {
    expect(() => parseEnv({ ...valid, BETTER_AUTH_SECRET: 'too-short' })).toThrow(/BETTER_AUTH_SECRET:/);
  });

  it('accepts only an http(s) auth address', () => {
    expect(parseEnv({ ...valid, BETTER_AUTH_URL: 'http://localhost:3000' }).BETTER_AUTH_URL).toBe(
      'http://localhost:3000',
    );
    expect(() => parseEnv({ ...valid, BETTER_AUTH_URL: 'ftp://example.com' })).toThrow(/BETTER_AUTH_URL:/);
    expect(() => parseEnv({ ...valid, BETTER_AUTH_URL: 'tanyeri.example.com' })).toThrow(/BETTER_AUTH_URL:/);
  });

  it('rejects a wrong scheme and a non-URL', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://u@h/db' })).toThrow(/DATABASE_URL:/);
    expect(() => parseEnv({ ...valid, DATABASE_URL_UNPOOLED: 'nonsense' })).toThrow(/DATABASE_URL_UNPOOLED:/);
  });

  it('never puts the value in the error message', () => {
    const secret = 'mysql://h/secret-db-name-7f3a';
    let message = '';
    try {
      parseEnv({ ...valid, DATABASE_URL: secret });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe('');
    expect(message).not.toContain('secret-db-name-7f3a');
    expect(message).not.toContain(secret);
  });
});

describe('getEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('validates process.env once and keeps the result', () => {
    vi.stubEnv('DATABASE_URL', valid.DATABASE_URL);
    vi.stubEnv('DATABASE_URL_UNPOOLED', valid.DATABASE_URL_UNPOOLED);
    vi.stubEnv('BETTER_AUTH_SECRET', valid.BETTER_AUTH_SECRET);
    vi.stubEnv('BETTER_AUTH_URL', valid.BETTER_AUTH_URL);
    const first = getEnv();
    vi.stubEnv('DATABASE_URL', 'not-a-url');
    expect(getEnv()).toBe(first);
  });
});

describe('isIndexingEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off when the variable is missing', () => {
    expect(isIndexingEnabled({})).toBe(false);
  });

  it('is on only for "on"', () => {
    expect(isIndexingEnabled({ SITE_INDEXING: 'on' })).toBe(true);
    expect(isIndexingEnabled({ SITE_INDEXING: 'off' })).toBe(false);
  });

  it('rejects any other value and names the variable', () => {
    expect(() => isIndexingEnabled({ SITE_INDEXING: 'yes' })).toThrow(/SITE_INDEXING/);
  });

  it('reads process.env by default', () => {
    vi.stubEnv('SITE_INDEXING', 'on');
    expect(isIndexingEnabled()).toBe(true);
  });
});

describe('isDevelopment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true only for the development environment', () => {
    expect(isDevelopment({ NODE_ENV: 'development' })).toBe(true);
    expect(isDevelopment({ NODE_ENV: 'production' })).toBe(false);
    expect(isDevelopment({})).toBe(false);
  });

  it('reads process.env by default', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(isDevelopment()).toBe(true);
  });
});

describe('isProduction', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true only for the production environment', () => {
    expect(isProduction({ NODE_ENV: 'production' })).toBe(true);
    expect(isProduction({ NODE_ENV: 'development' })).toBe(false);
    expect(isProduction({})).toBe(false);
  });

  it('reads process.env by default', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(isProduction()).toBe(true);
  });
});

describe('getBlobToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the token when it is set', () => {
    expect(getBlobToken({ BLOB_READ_WRITE_TOKEN: ' vercel_blob_rw_store_abc ' })).toBe('vercel_blob_rw_store_abc');
  });

  it('treats a missing, empty or blank token as unset', () => {
    expect(getBlobToken({})).toBeUndefined();
    expect(getBlobToken({ BLOB_READ_WRITE_TOKEN: '' })).toBeUndefined();
    expect(getBlobToken({ BLOB_READ_WRITE_TOKEN: '   ' })).toBeUndefined();
  });

  it('reads process.env by default', () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_store_abc');
    expect(getBlobToken()).toBe('vercel_blob_rw_store_abc');
  });
});

describe('getDemoAdminCredentials', () => {
  const demo = { DEMO_ADMIN_EMAIL: 'Demo@Example.com', DEMO_ADMIN_PASSWORD: 'x'.repeat(32) };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the pair with a lower-case email when both are set', () => {
    expect(getDemoAdminCredentials(demo)).toEqual({ email: 'demo@example.com', password: demo.DEMO_ADMIN_PASSWORD });
  });

  it('is undefined when neither is set, blank values included', () => {
    expect(getDemoAdminCredentials({})).toBeUndefined();
    expect(getDemoAdminCredentials({ DEMO_ADMIN_EMAIL: ' ', DEMO_ADMIN_PASSWORD: '' })).toBeUndefined();
  });

  it('names the missing or invalid variable when the pair is partly set or wrong', () => {
    expect(() => getDemoAdminCredentials({ DEMO_ADMIN_EMAIL: demo.DEMO_ADMIN_EMAIL })).toThrow(/DEMO_ADMIN_PASSWORD/);
    expect(() => getDemoAdminCredentials({ DEMO_ADMIN_PASSWORD: demo.DEMO_ADMIN_PASSWORD })).toThrow(
      /DEMO_ADMIN_EMAIL/,
    );
    expect(() => getDemoAdminCredentials({ ...demo, DEMO_ADMIN_PASSWORD: 'short' })).toThrow(/DEMO_ADMIN_PASSWORD:/);
  });

  it('reads process.env by default', () => {
    vi.stubEnv('DEMO_ADMIN_EMAIL', demo.DEMO_ADMIN_EMAIL);
    vi.stubEnv('DEMO_ADMIN_PASSWORD', demo.DEMO_ADMIN_PASSWORD);
    expect(getDemoAdminCredentials()?.email).toBe('demo@example.com');
  });
});

describe('getAdminCredentials', () => {
  const admin = { ADMIN_EMAIL: 'admin@example.com', ADMIN_PASSWORD: 'a password of enough length' };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the email and password', () => {
    expect(getAdminCredentials(admin)).toEqual({ email: 'admin@example.com', password: admin.ADMIN_PASSWORD });
  });

  it('lower-cases the email, as Better Auth does when it looks the user up', () => {
    expect(getAdminCredentials({ ...admin, ADMIN_EMAIL: 'Admin@Example.COM' }).email).toBe('admin@example.com');
  });

  it('accepts a password of exactly 12 characters and rejects 11', () => {
    expect(getAdminCredentials({ ...admin, ADMIN_PASSWORD: 'a'.repeat(12) }).password).toHaveLength(12);
    expect(() => getAdminCredentials({ ...admin, ADMIN_PASSWORD: 'a'.repeat(11) })).toThrow(/ADMIN_PASSWORD:/);
  });

  it('rejects a missing or malformed value and names the variable', () => {
    expect(() => getAdminCredentials({ ADMIN_PASSWORD: admin.ADMIN_PASSWORD })).toThrow(/ADMIN_EMAIL/);
    expect(() => getAdminCredentials({ ...admin, ADMIN_EMAIL: 'not-an-email' })).toThrow(/ADMIN_EMAIL:/);
    expect(() => getAdminCredentials({ ADMIN_EMAIL: admin.ADMIN_EMAIL })).toThrow(/ADMIN_PASSWORD/);
  });

  it('never puts the password in the error message', () => {
    expect(() => getAdminCredentials({ ...admin, ADMIN_PASSWORD: 'secret-7f3a' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret-7f3a') }),
    );
  });

  it('is not required by parseEnv: the running site starts without it', () => {
    expect(() => parseEnv(valid)).not.toThrow();
  });

  it('reads process.env by default', () => {
    vi.stubEnv('ADMIN_EMAIL', admin.ADMIN_EMAIL);
    vi.stubEnv('ADMIN_PASSWORD', admin.ADMIN_PASSWORD);
    expect(getAdminCredentials().email).toBe(admin.ADMIN_EMAIL);
  });
});

describe('isDemoMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off when the variable is missing', () => {
    expect(isDemoMode({})).toBe(false);
  });

  it('follows "true" and "false"', () => {
    expect(isDemoMode({ DEMO_MODE: 'true' })).toBe(true);
    expect(isDemoMode({ DEMO_MODE: 'false' })).toBe(false);
  });

  it('rejects any other value and names the variable', () => {
    for (const value of ['1', 'yes', 'TRUE', '']) {
      expect(() => isDemoMode({ DEMO_MODE: value })).toThrow(/DEMO_MODE/);
    }
  });

  it('reads process.env by default', () => {
    vi.stubEnv('DEMO_MODE', 'true');
    expect(isDemoMode()).toBe(true);
  });
});

const smtp = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'mailer',
  SMTP_PASSWORD: 'mailer-password-7f3a',
  SMTP_FROM: 'Tanyeri <no-reply@example.com>',
};

describe('getSmtpConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the whole group when every variable is set', () => {
    expect(getSmtpConfig(smtp)).toEqual({
      host: 'smtp.example.com',
      port: 587,
      user: 'mailer',
      password: 'mailer-password-7f3a',
      from: 'Tanyeri <no-reply@example.com>',
    });
  });

  it('accepts a plain address as the sender and trims the values', () => {
    expect(
      getSmtpConfig({ ...smtp, SMTP_HOST: ' smtp.example.com ', SMTP_FROM: 'no-reply@example.com' }),
    ).toMatchObject({
      host: 'smtp.example.com',
      from: 'no-reply@example.com',
    });
  });

  it('is off when no variable is set, or all are empty or blank', () => {
    expect(getSmtpConfig({})).toBeUndefined();
    expect(
      getSmtpConfig({ SMTP_HOST: '', SMTP_PORT: '  ', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_FROM: '' }),
    ).toBeUndefined();
  });

  it('rejects a partial group and names every missing variable', () => {
    const partial = { ...smtp, SMTP_PORT: undefined, SMTP_FROM: undefined };
    expect(() => getSmtpConfig(partial)).toThrow(/SMTP_PORT: required when any other SMTP variable is set/);
    expect(() => getSmtpConfig(partial)).toThrow(/SMTP_FROM: required when any other SMTP variable is set/);
    expect(() => getSmtpConfig({ SMTP_HOST: 'smtp.example.com' })).toThrow(/SMTP_PORT[\s\S]*SMTP_FROM/);
    expect(() => getSmtpConfig({ ...smtp, SMTP_PASSWORD: '' })).toThrow(/SMTP_PASSWORD: required/);
  });

  it('rejects a bad port or sender and names the variable', () => {
    for (const port of ['abc', '0', '70000', '25.5']) {
      expect(() => getSmtpConfig({ ...smtp, SMTP_PORT: port })).toThrow(/SMTP_PORT:/);
    }
    expect(() => getSmtpConfig({ ...smtp, SMTP_FROM: 'not an address' })).toThrow(/SMTP_FROM:/);
    expect(() => getSmtpConfig({ ...smtp, SMTP_FROM: 'Name <broken>' })).toThrow(/SMTP_FROM:/);
  });

  it('never puts a value in the error message', () => {
    for (const source of [
      { ...smtp, SMTP_PORT: 'port-secret-7f3a' },
      { ...smtp, SMTP_FROM: 'from-secret-7f3a' },
      { SMTP_PASSWORD: smtp.SMTP_PASSWORD },
    ]) {
      let message = '';
      try {
        getSmtpConfig(source);
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toBe('');
      expect(message).not.toContain('7f3a');
    }
  });

  it('reads process.env by default', () => {
    for (const [name, value] of Object.entries(smtp)) vi.stubEnv(name, value);
    expect(getSmtpConfig()?.host).toBe('smtp.example.com');
  });
});

describe('isEmailEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is on only when the whole group is set', () => {
    expect(isEmailEnabled(smtp)).toBe(true);
    expect(isEmailEnabled({})).toBe(false);
  });

  it('fails on a partial group instead of quietly staying off', () => {
    expect(() => isEmailEnabled({ SMTP_HOST: 'smtp.example.com' })).toThrow(/SMTP_PORT/);
  });

  it('reads process.env by default', () => {
    expect(isEmailEnabled()).toBe(false);
    for (const [name, value] of Object.entries(smtp)) vi.stubEnv(name, value);
    expect(isEmailEnabled()).toBe(true);
  });
});

describe('isVercel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true only when Vercel sets VERCEL to 1', () => {
    expect(isVercel({ VERCEL: '1' })).toBe(true);
    expect(isVercel({ VERCEL: '0' })).toBe(false);
    expect(isVercel({ VERCEL: '' })).toBe(false);
    expect(isVercel({})).toBe(false);
  });

  it('reads process.env by default', () => {
    vi.stubEnv('VERCEL', '1');
    expect(isVercel()).toBe(true);
  });
});

describe('getSiteUrl', () => {
  it('uses SITE_URL and keeps only its origin', () => {
    expect(getSiteUrl({ SITE_URL: 'https://example.com/some/path?x=1' }).href).toBe('https://example.com/');
  });

  it('prefers SITE_URL over the Vercel production host', () => {
    expect(getSiteUrl({ SITE_URL: 'https://a.example', VERCEL_PROJECT_PRODUCTION_URL: 'b.example' }).host).toBe(
      'a.example',
    );
  });

  it('falls back to the Vercel production host, which has no scheme', () => {
    expect(getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'tanyeri.example' }).href).toBe('https://tanyeri.example/');
  });

  it('treats blank values as unset and falls back to localhost', () => {
    expect(getSiteUrl({ SITE_URL: '  ', VERCEL_PROJECT_PRODUCTION_URL: '' }).href).toBe('http://localhost:3000/');
    expect(getSiteUrl({}).href).toBe('http://localhost:3000/');
  });

  it('rejects an address that is not http(s) without printing it', () => {
    expect(() => getSiteUrl({ SITE_URL: 'ftp://secret.example' })).toThrow(/SITE_URL: must be an http\(s\) address/);
    expect(() => getSiteUrl({ SITE_URL: 'ftp://secret.example' })).not.toThrow(/secret/);
    expect(() => getSiteUrl({ SITE_URL: 'not a url' })).toThrow(/SITE_URL/);
  });

  it('reads process.env by default', () => {
    vi.stubEnv('SITE_URL', 'https://env.example');
    expect(getSiteUrl().host).toBe('env.example');
  });
});
