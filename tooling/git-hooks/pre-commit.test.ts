// End-to-end test of the pre-commit hook in a throwaway repo whose core.hooksPath points at the real hooks.
// A stub gitleaks binary is put first on PATH so the test never needs docker; the real rules are tested in
// gitleaks-rules.test.ts.
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from '../scripts/lib/bash.ts';

const tooling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bash = resolveBash() as string; // null only without a usable bash, and then every suite is skipped

// the pinned gitleaks version, read from the manifest the hook reads
const PINNED = /gitleaks:v?([^@\s]+)@/.exec(readFileSync(path.join(tooling, 'ci-images', 'Dockerfile'), 'utf8'))?.[1] as string;
const stubBin = (dir: string, name: string, body: string): void => {
  writeFileSync(path.join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path.join(dir, name), 0o755);
};
// a fake gitleaks that reports `version` and otherwise runs `body`
const fakeGitleaks = (version: string, body: string): string =>
  `if [ "\${1:-}" = version ]; then echo ${version}; exit 0; fi\n${body}`;

// a repo on main with the check scripts committed (hooks off), switched to `branch`
type Git = (...args: string[]) => SpawnSyncReturns<string>;

const withRepo = (branch: string, fn: (repo: string, git: Git) => void): void => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'pre-commit-')));
  const stub = path.join(dir, '.stub-bin');
  try {
    mkdirSync(stub);
    stubBin(stub, 'gitleaks', fakeGitleaks(PINNED, 'exit 0'));
    const repo = path.join(dir, 'repo');
    mkdirSync(path.join(repo, 'tooling', 'scripts'), { recursive: true });
    mkdirSync(path.join(repo, 'tooling', 'ci-images'), { recursive: true });
    for (const f of readdirSync(path.join(tooling, 'scripts')).filter((n) => n.endsWith('.sh'))) {
      copyFileSync(path.join(tooling, 'scripts', f), path.join(repo, 'tooling', 'scripts', f));
    }
    copyFileSync(path.join(tooling, 'ci-images', 'Dockerfile'), path.join(repo, 'tooling', 'ci-images', 'Dockerfile'));
    const sep = process.platform === 'win32' ? ';' : ':';
    const env = { ...process.env, PATH: `${stub}${sep}${process.env.PATH}` };
    const git: Git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env });
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('config', 'commit.gpgsign', 'false');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
    if (branch !== 'main') git('switch', '-q', '-c', branch);
    git('config', 'core.hooksPath', path.join(tooling, 'git-hooks'));
    return fn(repo, git);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
describe('pre-commit hook', { skip: bash ? false : 'bash not found' }, () => {
  test('refuses a commit on main', () => {
    withRepo('main', (repo, git) => {
      writeFileSync(path.join(repo, 'a.txt'), 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', 'feat: x', '--no-edit');
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /direct commits to main/);
    });
  });
  test('refuses a badly named branch', () => {
    withRepo('Feature_X', (repo, git) => {
      writeFileSync(path.join(repo, 'a.txt'), 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', 'feat: x');
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /branch-name/);
    });
  });
  test('refuses forbidden terms in staged content', () => {
    withRepo('feat/x', (repo, git) => {
      writeFileSync(path.join(repo, 'a.txt'), `uses ${['cl', 'aude'].join('')}\n`);
      git('add', '-A');
      const r = git('commit', '-m', 'feat: x');
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /forbidden-terms/);
    });
  });
  test('refuses forbidden paths', () => {
    withRepo('feat/x', (repo, git) => {
      writeFileSync(path.join(repo, '.env'), 'A=1\n');
      git('add', '-A', '-f');
      const r = git('commit', '-m', 'feat: x');
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /forbidden-paths: \.env/);
    });
  });
  test('passes pre-commit on a clean change on a valid branch', () => {
    withRepo('feat/x', (repo, git) => {
      writeFileSync(path.join(repo, 'a.txt'), 'x\n');
      git('add', '-A');
      // run directly: the commit-msg hook would additionally demand a message body and a journal line
      const r = spawnSync(bash, [path.join(tooling, 'git-hooks', 'pre-commit')], {
        cwd: repo,
        encoding: 'utf8',
        env: { ...process.env, PATH: `${path.join(repo, '..', '.stub-bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` },
      });
      assert.equal(r.status, 0, r.stderr);
    });
  });
  test('a failing secret scan blocks the commit', () => {
    withRepo('feat/x', (repo, git) => {
      stubBin(path.join(repo, '..', '.stub-bin'), 'gitleaks', fakeGitleaks(PINNED, 'echo leak >&2\nexit 1'));
      writeFileSync(path.join(repo, 'a.txt'), 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', 'feat: x');
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /leak/);
    });
  });

  // runs the hook directly with the stub dir first on PATH
  const runHook = (repo: string): SpawnSyncReturns<string> =>
    spawnSync(bash, [path.join(tooling, 'git-hooks', 'pre-commit')], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${path.join(repo, '..', '.stub-bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}` },
    });
  const stage = (repo: string, git: Git): void => {
    writeFileSync(path.join(repo, 'a.txt'), 'x\n');
    git('add', '-A');
  };

  test('a PATH gitleaks of another version is not used; the pinned image runs through docker', () => {
    withRepo('feat/x', (repo, git) => {
      const stub = path.join(repo, '..', '.stub-bin');
      stubBin(stub, 'gitleaks', fakeGitleaks('0.0.1', 'echo wrong-binary-used >&2\nexit 1'));
      stubBin(stub, 'docker', 'if [ "${1:-}" = info ]; then exit 0; fi\necho "docker $*" >&2\nexit 0');
      stage(repo, git);
      const r = runHook(repo);
      assert.equal(r.status, 0, r.stderr);
      assert.doesNotMatch(r.stderr, /wrong-binary-used/);
      assert.match(r.stderr, new RegExp(`docker run .*gitleaks:v${PINNED.replaceAll('.', '\\.')}@sha256:`));
    });
  });

  test('a commit is rejected, never skipped, when no scanner is usable', () => {
    withRepo('feat/x', (repo, git) => {
      const stub = path.join(repo, '..', '.stub-bin');
      stubBin(stub, 'gitleaks', fakeGitleaks('0.0.1', 'exit 0'));
      stubBin(stub, 'docker', 'exit 1');
      stubBin(stub, 'podman', 'exit 1');
      stage(repo, git);
      const r = runHook(repo);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /no usable secret scanner; commit rejected/);
      assert.match(r.stderr, new RegExp(`gitleaks ${PINNED.replaceAll('.', '\\.')}`));
      assert.match(r.stderr, /doctor\.ts/);
    });
  });
});
