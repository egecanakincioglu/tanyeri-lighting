// End-to-end test of the pre-commit hook in a throwaway repo whose core.hooksPath points at the real hooks.
// A stub gitleaks binary is put first on PATH so the test never needs docker; the real rules are tested in
// .gitleaks.test.mjs.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from '../scripts/lib/bash.mjs';

const tooling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bash = resolveBash();

// a repo on main with the check scripts committed (hooks off), switched to `branch`
const withRepo = (branch, fn) => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'pre-commit-')));
  const stub = path.join(dir, '.stub-bin');
  try {
    mkdirSync(stub);
    writeFileSync(path.join(stub, 'gitleaks'), '#!/usr/bin/env bash\nexit 0\n');
    chmodSync(path.join(stub, 'gitleaks'), 0o755);
    const repo = path.join(dir, 'repo');
    mkdirSync(path.join(repo, 'tooling', 'scripts'), { recursive: true });
    mkdirSync(path.join(repo, 'tooling', 'ci-images'), { recursive: true });
    for (const f of readdirSync(path.join(tooling, 'scripts')).filter((n) => n.endsWith('.sh'))) {
      copyFileSync(path.join(tooling, 'scripts', f), path.join(repo, 'tooling', 'scripts', f));
    }
    copyFileSync(path.join(tooling, 'ci-images', 'Dockerfile'), path.join(repo, 'tooling', 'ci-images', 'Dockerfile'));
    const sep = process.platform === 'win32' ? ';' : ':';
    const env = { ...process.env, PATH: `${stub}${sep}${process.env.PATH}` };
    const git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env });
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
      writeFileSync(path.join(repo, '..', '.stub-bin', 'gitleaks'), '#!/usr/bin/env bash\necho leak >&2\nexit 1\n');
      writeFileSync(path.join(repo, 'a.txt'), 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', 'feat: x');
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /leak/);
    });
  });
});
