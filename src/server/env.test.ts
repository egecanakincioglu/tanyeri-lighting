// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnv, isDevelopment, isIndexingEnabled, parseEnv } from './env.ts';

const valid = {
  DATABASE_URL: 'postgresql://pool.example.com:5432/tanyeri',
  DATABASE_URL_UNPOOLED: 'postgres://db.example.com:5432/tanyeri',
};

describe('parseEnv', () => {
  it('accepts both postgres schemes', () => {
    expect(parseEnv(valid)).toEqual(valid);
  });

  it('rejects a missing variable and names it', () => {
    expect(() => parseEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/DATABASE_URL_UNPOOLED/);
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
