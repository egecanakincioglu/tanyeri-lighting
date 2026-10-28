// Tests for setup-commit-signing.sh: real bash, git and ssh-keygen, a temporary HOME and global git config.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from './lib/bash.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'setup-commit-signing.sh');
const tmp = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'tanyeri-signing-'));
let counter = 0;
after(() => rmSync(tmp, { recursive: true, force: true }));

// On Windows plain `bash` may be the WSL launcher, so Git Bash is resolved explicitly.
const BASH = resolveBash();
const bashOk = BASH !== null && spawnSync(BASH, ['--version'], { encoding: 'utf8' }).status === 0;
const keygenOk = spawnSync('ssh-keygen', ['-?'], { encoding: 'utf8' }).error === undefined;
const skip = !bashOk || !keygenOk ? 'bash or ssh-keygen is not available' : false;

const fwd = (p: string): string => p.replace(/\\/g, '/');

type Ctx = ReturnType<typeof sandbox>;

function sandbox() {
  const dir = path.join(tmp, `t${counter++}`);
  const home = path.join(dir, 'home');
  const repo = path.join(dir, 'repo');
  mkdirSync(path.join(home, '.ssh'), { recursive: true });
  mkdirSync(repo, { recursive: true });
  const globalConfig = path.join(dir, 'gitconfig');
  writeFileSync(globalConfig, '');
  const env = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: '1',
  };
  const git = (cwd: string, ...args: string[]) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env });
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  };
  git(repo, 'init', '-q', '-b', 'main');
  return { dir, home, repo, env, git };
}

const run = (ctx: Ctx) => {
  const r = spawnSync(BASH as string, [SCRIPT], { cwd: ctx.repo, encoding: 'utf8', env: ctx.env });
  return { status: r.status, out: r.stdout, err: r.stderr };
};
const localGit = (ctx: Ctx, ...args: string[]) =>
  spawnSync('git', ['config', '--local', ...args], { cwd: ctx.repo, encoding: 'utf8', env: ctx.env }).stdout.trim();
const local = (ctx: Ctx, key: string) => localGit(ctx, '--get', key);
const genKey = (ctx: Ctx, name: string) => {
  const key = path.join(ctx.home, '.ssh', name);
  const r = spawnSync('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'existing', '-f', key], {
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  return key;
};

describe('setup-commit-signing.sh', { skip }, () => {
  test('the script is valid bash', () => {
    assert.equal(spawnSync(BASH as string, ['-n', SCRIPT]).status, 0);
  });

  test('fails without user.email', () => {
    const ctx = sandbox();
    const r = run(ctx);
    assert.equal(r.status, 1);
    assert.match(r.err, /user\.email is not set/);
  });

  test('generates a tanyeri key, configures the clone and prints the gh command', () => {
    const ctx = sandbox();
    ctx.git(ctx.repo, 'config', 'user.email', 'owner@example.com');
    const r = run(ctx);
    assert.equal(r.status, 0, r.err);
    const pub = readFileSync(path.join(ctx.home, '.ssh', 'tanyeri_signing_ed25519.pub'), 'utf8').trim();
    assert.match(pub, /^ssh-ed25519 \S+ owner@example\.com tanyeri-signing \S+$/);
    assert.equal(local(ctx, 'gpg.format'), 'ssh');
    assert.equal(local(ctx, 'commit.gpgsign'), 'true');
    assert.equal(local(ctx, 'tag.gpgsign'), 'true');
    assert.match(local(ctx, 'user.signingkey'), /tanyeri_signing_ed25519\.pub$/);
    assert.match(local(ctx, 'gpg.ssh.allowedsignersfile'), /tanyeri_allowed_signers$/);
    const [type, data] = pub.split(' ');
    const signers = readFileSync(path.join(ctx.home, '.ssh', 'tanyeri_allowed_signers'), 'utf8');
    assert.equal(signers.trim(), `owner@example.com ${type} ${data}`);
    assert.match(r.err, /gh ssh-key add .*tanyeri_signing_ed25519\.pub" --type signing/);
  });

  test('is idempotent: same key, one signer line', () => {
    const ctx = sandbox();
    ctx.git(ctx.repo, 'config', 'user.email', 'owner@example.com');
    run(ctx);
    const pubFile = path.join(ctx.home, '.ssh', 'tanyeri_signing_ed25519.pub');
    const first = readFileSync(pubFile, 'utf8');
    const r = run(ctx);
    assert.equal(r.status, 0, r.err);
    assert.equal(readFileSync(pubFile, 'utf8'), first);
    const signers = readFileSync(path.join(ctx.home, '.ssh', 'tanyeri_allowed_signers'), 'utf8');
    assert.equal(signers.trim().split('\n').length, 1);
  });

  test('keeps an existing signing key and creates no new key', () => {
    const ctx = sandbox();
    const key = genKey(ctx, 'id_existing');
    ctx.git(ctx.repo, 'config', '--global', 'user.email', 'owner@example.com');
    ctx.git(ctx.repo, 'config', '--global', 'user.signingkey', fwd(`${key}.pub`));
    const r = run(ctx);
    assert.equal(r.status, 0, r.err);
    assert.equal(existsSync(path.join(ctx.home, '.ssh', 'tanyeri_signing_ed25519')), false);
    assert.equal(local(ctx, 'user.signingkey'), '');
    assert.equal(local(ctx, 'gpg.format'), 'ssh');
    assert.equal(local(ctx, 'commit.gpgsign'), 'true');
    assert.equal(r.err, '', 'no registration instructions for an existing key');
    const data = readFileSync(`${key}.pub`, 'utf8').split(' ')[1];
    const signers = readFileSync(path.join(ctx.home, '.ssh', 'tanyeri_allowed_signers'), 'utf8');
    assert.equal(signers.trim(), `owner@example.com ssh-ed25519 ${data}`);
  });

  test('is a complete no-op on a machine that is already configured', () => {
    const ctx = sandbox();
    const key = genKey(ctx, 'id_existing');
    const [type, data] = readFileSync(`${key}.pub`, 'utf8').split(' ');
    const signers = path.join(ctx.home, '.ssh', 'allowed_signers');
    const original = `owner@example.com ${type} ${data}\n`;
    writeFileSync(signers, original);
    for (const [k, v] of [
      ['user.email', 'owner@example.com'],
      ['user.signingkey', fwd(`${key}.pub`)],
      ['gpg.format', 'ssh'],
      ['commit.gpgsign', 'true'],
      ['tag.gpgsign', 'true'],
      ['gpg.ssh.allowedSignersFile', fwd(signers)],
    ])
      ctx.git(ctx.repo, 'config', '--global', k, v);
    const before = readFileSync(ctx.env.GIT_CONFIG_GLOBAL, 'utf8');
    const r = run(ctx);
    assert.equal(r.status, 0, r.err);
    assert.equal(localGit(ctx, '--list').includes('gpg'), false);
    assert.equal(readFileSync(ctx.env.GIT_CONFIG_GLOBAL, 'utf8'), before);
    assert.equal(readFileSync(signers, 'utf8'), original);
    assert.equal(existsSync(path.join(ctx.home, '.ssh', 'tanyeri_signing_ed25519')), false);
    assert.doesNotMatch(r.out, /^(set|added|created)/m);
    assert.equal(r.err, '');
  });

  test('an existing allowed signers file without the key gets one appended line', () => {
    const ctx = sandbox();
    const key = genKey(ctx, 'id_existing');
    const signers = path.join(ctx.home, '.ssh', 'allowed_signers');
    writeFileSync(signers, 'other@example.com ssh-ed25519 AAAAother\n');
    ctx.git(ctx.repo, 'config', '--global', 'user.email', 'owner@example.com');
    ctx.git(ctx.repo, 'config', '--global', 'user.signingkey', fwd(`${key}.pub`));
    ctx.git(ctx.repo, 'config', '--global', 'gpg.ssh.allowedSignersFile', fwd(signers));
    assert.equal(run(ctx).status, 0);
    const lines = readFileSync(signers, 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    assert.equal(lines[0], 'other@example.com ssh-ed25519 AAAAother');
    assert.match(lines[1], /^owner@example\.com ssh-ed25519 /);
  });
});
