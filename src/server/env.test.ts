// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnv, parseEnv } from './env.ts';

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
