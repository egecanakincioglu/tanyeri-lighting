// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'DATABASE_URL_UNPOOLED';

describe('prisma.config datasource url', () => {
  const originalCwd = process.cwd();
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'prisma-config-'));
    writeFileSync(join(dir, '.env'), `${KEY}=postgresql://from-dotenv/db\n`);
    process.chdir(dir);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('takes the url from .env when the variable is unset', async () => {
    vi.stubEnv(KEY, undefined);
    const { default: config } = await import('../prisma.config.ts');
    expect(config.datasource?.url).toBe('postgresql://from-dotenv/db');
  });

  it('keeps a variable that is already set', async () => {
    vi.stubEnv(KEY, 'postgresql://from-environment/db');
    const { default: config } = await import('../prisma.config.ts');
    expect(config.datasource?.url).toBe('postgresql://from-environment/db');
  });
});
