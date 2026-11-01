// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getAdminCredentials,
  getBlobToken,
  getEnv,
  isDemoMode,
  isDevelopment,
  isIndexingEnabled,
  isProduction,
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
