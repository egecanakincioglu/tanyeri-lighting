import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { verifyPassword } from 'better-auth/crypto';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../app/api/auth/[...all]/route.ts';
import { TEST_AUTH_URL } from '../../test/integration-env.ts';
import { getDb } from '../db.ts';
import { createFirstAdmin, resetAdminPassword } from './admin.ts';

const EMAIL = 'first-admin@example.com';
const PASSWORD = 'correct horse battery staple';
const NEW_PASSWORD = 'another long passphrase 42';

// The sign-in limit is per client address and endpoint, so every test uses addresses of its own.
let nextAddress = 1;

function signIn(email: string, password: string): Promise<Response> {
  return POST(
    new Request(`${TEST_AUTH_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: TEST_AUTH_URL,
        'x-forwarded-for': `203.0.113.${nextAddress++}`,
      },
      body: JSON.stringify({ email, password }),
    }),
  );
}

// The commands run as the real processes: Node strips the types itself, no loader is involved.
// The child inherits the integration database variables from the test environment.
function runScript(script: string, args: string[], input?: string) {
  return spawnSync(process.execPath, [path.join(process.cwd(), script), ...args], { input, encoding: 'utf8' });
}

async function resetTables(): Promise<void> {
  const db = getDb();
  await db.rateLimit.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
}

describe('createFirstAdmin', () => {
  beforeEach(resetTables);

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('creates the admin with a hashed password', async () => {
    expect(await createFirstAdmin(getDb(), { email: EMAIL, password: PASSWORD })).toBe('created');

    const user = await getDb().user.findUniqueOrThrow({ where: { email: EMAIL }, include: { accounts: true } });
    expect(user.emailVerified).toBe(true);
    expect(user.accounts).toHaveLength(1);
    const [account] = user.accounts;
    expect(account?.providerId).toBe('credential');
    expect(account?.accountId).toBe(user.id);
    expect(account?.password).not.toBeNull();
    expect(account?.password).not.toContain(PASSWORD);
    expect(await verifyPassword({ hash: account?.password ?? '', password: PASSWORD })).toBe(true);
  });

  it('changes nothing when the email already exists', async () => {
    await createFirstAdmin(getDb(), { email: EMAIL, password: PASSWORD });
    const before = await getDb().account.findFirstOrThrow();

    expect(await createFirstAdmin(getDb(), { email: EMAIL, password: NEW_PASSWORD })).toBe('exists');

    expect(await getDb().user.count()).toBe(1);
    expect(await getDb().account.count()).toBe(1);
    expect((await getDb().account.findFirstOrThrow()).password).toBe(before.password);
  });

  it('lets the seeded admin sign in through the real endpoint, and nobody else', async () => {
    await createFirstAdmin(getDb(), { email: EMAIL, password: PASSWORD });

    const response = await signIn(EMAIL, PASSWORD);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(';')).toContain('session_token=');
    expect((await signIn(EMAIL, NEW_PASSWORD)).status).toBe(401);
  });
});

describe('resetAdminPassword', () => {
  beforeEach(async () => {
    await resetTables();
    await createFirstAdmin(getDb(), { email: EMAIL, password: PASSWORD });
  });

  it('stores the new hash, ends every session, and swaps which password works', async () => {
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
    expect(await getDb().session.count()).toBe(2);

    expect(await resetAdminPassword(getDb(), { email: EMAIL, password: NEW_PASSWORD })).toBe('reset');

    expect(await getDb().session.count()).toBe(0);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(401);
    expect((await signIn(EMAIL, NEW_PASSWORD)).status).toBe(200);
  });

  it('leaves the sessions of other users alone', async () => {
    await getDb().user.create({ data: { id: 'other', name: 'Other', email: 'other@example.com' } });
    await getDb().session.create({
      data: { id: 'other-session', token: 'other-token', userId: 'other', expiresAt: new Date(Date.now() + 60_000) },
    });

    await resetAdminPassword(getDb(), { email: EMAIL, password: NEW_PASSWORD });

    expect(await getDb().session.count({ where: { userId: 'other' } })).toBe(1);
  });

  it('reports an unknown email and changes nothing', async () => {
    const before = await getDb().account.findFirstOrThrow();

    expect(await resetAdminPassword(getDb(), { email: 'nobody@example.com', password: NEW_PASSWORD })).toBe('unknown');

    expect((await getDb().account.findFirstOrThrow()).password).toBe(before.password);
  });
});

describe('the commands as real processes', () => {
  beforeEach(resetTables);

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('seeds the admin with `prisma/seed.ts`, never prints the password, and is idempotent', async () => {
    vi.stubEnv('ADMIN_EMAIL', EMAIL);
    vi.stubEnv('ADMIN_PASSWORD', PASSWORD);

    const first = runScript('prisma/seed.ts', []);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('Created');
    const hash = (await getDb().account.findFirstOrThrow()).password;

    const second = runScript('prisma/seed.ts', []);
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('already exists');
    expect(await getDb().user.count()).toBe(1);
    expect((await getDb().account.findFirstOrThrow()).password).toBe(hash);

    expect(first.stdout + first.stderr + second.stdout + second.stderr).not.toContain(PASSWORD);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('fails the seed on a short password without touching the database', async () => {
    vi.stubEnv('ADMIN_EMAIL', EMAIL);
    vi.stubEnv('ADMIN_PASSWORD', 'short');

    const result = runScript('prisma/seed.ts', []);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ADMIN_PASSWORD');
    expect(result.stderr).not.toContain('short');
    expect(await getDb().user.count()).toBe(0);
  });

  it('resets the password from stdin and ends the sessions', async () => {
    await createFirstAdmin(getDb(), { email: EMAIL, password: PASSWORD });
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);

    const result = runScript('tooling/scripts/admin-reset-password.ts', ['--email', EMAIL], `${NEW_PASSWORD}\n`);

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(NEW_PASSWORD);
    expect(await getDb().session.count()).toBe(0);
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(401);
    expect((await signIn(EMAIL, NEW_PASSWORD)).status).toBe(200);
  });

  it('exits non-zero for an unknown email', async () => {
    await createFirstAdmin(getDb(), { email: EMAIL, password: PASSWORD });

    const result = runScript(
      'tooling/scripts/admin-reset-password.ts',
      ['--email', 'nobody@example.com'],
      NEW_PASSWORD,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No admin');
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('exits non-zero for a short password and keeps the old one working', async () => {
    await createFirstAdmin(getDb(), { email: EMAIL, password: PASSWORD });

    const result = runScript('tooling/scripts/admin-reset-password.ts', ['--email', EMAIL], 'short');

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('at least 12');
    expect((await signIn(EMAIL, PASSWORD)).status).toBe(200);
  });
});
