// Tests for setup-git-hooks.sh in a temporary repository with a temporary HOME and global git config.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from './lib/bash.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'tanyeri-hooks-'));
let counter = 0;
after(() => rmSync(tmp, { recursive: true, force: true }));

const BASH = resolveBash();
const bashOk = BASH !== null && spawnSync(BASH, ['--version'], { encoding: 'utf8' }).status === 0;
const keygenOk = spawnSync('ssh-keygen', ['-?'], { encoding: 'utf8' }).error === undefined;
const skip = !bashOk || !keygenOk ? 'bash or ssh-keygen is not available' : false;

function sandbox() {
  const dir = path.join(tmp, `t${counter++}`);
  const home = path.join(dir, 'home');
  const repo = path.join(dir, 'repo');
  mkdirSync(home, { recursive: true });
  mkdirSync(path.join(repo, 'tooling', 'scripts'), { recursive: true });
  mkdirSync(path.join(repo, 'tooling', 'git-hooks'), { recursive: true });
  for (const f of ['setup-git-hooks.sh', 'setup-commit-signing.sh'])
    copyFileSync(path.join(HERE, f), path.join(repo, 'tooling', 'scripts', f));
  // stands in for the real doctor: proves the setup calls it, and that its failure does not fail the setup
  writeFileSync(path.join(repo, 'tooling', 'scripts', 'doctor.mjs'), "console.log('DOCTOR-RAN');\nprocess.exit(1);\n");
  const globalConfig = path.join(dir, 'gitconfig');
  writeFileSync(globalConfig, '');
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env }).stdout.trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'owner@example.com');
  return { repo, env, git };
}

const run = (ctx) => {
  const r = spawnSync(BASH, ['tooling/scripts/setup-git-hooks.sh'], { cwd: ctx.repo, encoding: 'utf8', env: ctx.env });
  return { status: r.status, out: r.stdout, err: r.stderr };
};

describe('setup-git-hooks.sh', { skip }, () => {
  test('the script is valid bash', () => {
    assert.equal(spawnSync(BASH, ['-n', path.join(HERE, 'setup-git-hooks.sh')]).status, 0);
  });

  test('sets the absolute hooks path and autocrlf=false, then signing and the doctor', () => {
    const ctx = sandbox();
    ctx.git('config', '--local', 'core.autocrlf', 'true');
    const r = run(ctx);
    assert.equal(r.status, 0, r.err);
    const hooks = ctx.git('config', '--local', '--get', 'core.hooksPath').replace(/\\/g, '/').toLowerCase();
    assert.match(hooks, /^([a-z]:)?\//);
    assert.ok(hooks.endsWith('/repo/tooling/git-hooks'), hooks);
    assert.equal(ctx.git('config', '--local', '--get', 'core.autocrlf'), 'false');
    assert.equal(ctx.git('config', '--local', '--get', 'commit.gpgsign'), 'true');
    assert.ok(existsSync(path.join(ctx.env.HOME, '.ssh', 'tanyeri_signing_ed25519.pub')));
    assert.match(r.out, /DOCTOR-RAN/);
  });

  test('is idempotent and never fails because of the doctor', () => {
    const ctx = sandbox();
    assert.equal(run(ctx).status, 0);
    const before = ctx.git('config', '--local', '--list');
    const r = run(ctx);
    assert.equal(r.status, 0, r.err);
    assert.equal(ctx.git('config', '--local', '--list'), before);
  });
});
