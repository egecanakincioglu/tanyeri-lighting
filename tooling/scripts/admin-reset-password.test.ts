// Input checks of the recovery command. They fail before any database access, so no database is needed here;
// the effect on the database is covered by the integration tests in src/server/auth/admin.int.test.ts.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'admin-reset-password.ts');

function run(args: string[], input: string) {
  return spawnSync(process.execPath, [script, ...args], { input, encoding: 'utf8' });
}

describe('admin-reset-password', () => {
  it('fails without --email', () => {
    const result = run([], 'a password of enough length\n');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--email/);
  });

  it('fails for a malformed email', () => {
    const result = run(['--email', 'nonsense'], 'a password of enough length\n');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--email/);
  });

  it('fails for a password shorter than 12 characters and never prints it', () => {
    const result = run(['--email', 'admin@example.com'], 'short-pw-1\n');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /at least 12/);
    assert.ok(!(result.stdout + result.stderr).includes('short-pw-1'));
  });

  it('fails for an unknown option and never prints the password', () => {
    const result = run(['--password', 'a password of enough length'], 'a password of enough length\n');
    assert.equal(result.status, 1);
    assert.ok(!(result.stdout + result.stderr).includes('a password of enough length'));
  });
});
