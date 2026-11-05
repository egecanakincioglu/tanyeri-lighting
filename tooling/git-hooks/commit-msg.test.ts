// End-to-end test of the commit-msg hook (and pre-commit) in a throwaway repo;
// stub scanners keep gitleaks and docker out.
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from '../scripts/lib/bash.ts';
import { installScannerStubs } from '../scripts/lib/scanner-stubs.ts';

const tooling = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bash = resolveBash() as string; // null only without a usable bash, and then every suite is skipped

type Git = (...args: string[]) => SpawnSyncReturns<string>;

const withRepo = (fn: (repo: string, git: Git) => void): void => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'commit-msg-hook-')));
  try {
    const stub = path.join(dir, 'stub-bin');
    mkdirSync(stub);
    installScannerStubs(stub);
    const repo = path.join(dir, 'repo');
    mkdirSync(path.join(repo, 'tooling', 'scripts'), { recursive: true });
    mkdirSync(path.join(repo, 'tooling', 'ci-images'), { recursive: true });
    for (const f of readdirSync(path.join(tooling, 'scripts')).filter((n) => n.endsWith('.sh'))) {
      copyFileSync(path.join(tooling, 'scripts', f), path.join(repo, 'tooling', 'scripts', f));
    }
    copyFileSync(path.join(tooling, 'ci-images', 'Dockerfile'), path.join(repo, 'tooling', 'ci-images', 'Dockerfile'));
    const env = { ...process.env, PATH: `${stub}${path.delimiter}${process.env.PATH}` };
    const git: Git = (...args) => spawnSync('git', args, { cwd: repo, encoding: 'utf8', env });
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    git('config', 'commit.gpgsign', 'false');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
    git('switch', '-q', '-c', 'feat/x');
    git('config', 'core.hooksPath', path.join(tooling, 'git-hooks'));
    return fn(repo, git);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const write = (repo: string, file: string, content: string): void => {
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), content);
};
const header = 'feat: add thing';
const msg = `${header}\n\nAdds the thing.\n`;

describe('commit-msg hook', { skip: bash ? false : 'bash not found' }, () => {
  test('a good message passes', () => {
    withRepo((repo, git) => {
      write(repo, 'a.txt', 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', msg);
      assert.equal(r.status, 0, r.stderr);
    });
  });
  test('a bad header is refused', () => {
    withRepo((repo, git) => {
      write(repo, 'a.txt', 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', 'Add thing\n\nbody');
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /commit-msg: header must match/);
    });
  });
  test('a message without a body is refused', () => {
    withRepo((repo, git) => {
      write(repo, 'a.txt', 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', header);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /body/);
    });
  });
  test('a forbidden term in the message is refused', () => {
    withRepo((repo, git) => {
      write(repo, 'a.txt', 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', `${header}\n\nmentions ${['af', 'ra'].join('')}\n`);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /forbidden-terms/);
    });
  });

  const localHook = (repo: string, body: string): void => {
    write(repo, '.git/hooks/commit-msg', `#!/bin/sh\n${body}\n`);
    chmodSync(path.join(repo, '.git', 'hooks', 'commit-msg'), 0o755);
  };
  test('a machine-local commit-msg hook runs with the message file', () => {
    withRepo((repo, git) => {
      localHook(repo, 'head -n 1 "$1" > "$(dirname "$0")/seen"');
      write(repo, 'a.txt', 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', msg);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(readFileSync(path.join(repo, '.git', 'hooks', 'seen'), 'utf8').trim(), header);
    });
  });
  test('a failing machine-local commit-msg hook blocks the commit', () => {
    withRepo((repo, git) => {
      localHook(repo, 'echo local-refusal >&2\nexit 1');
      write(repo, 'a.txt', 'x\n');
      git('add', '-A');
      const r = git('commit', '-m', msg);
      assert.notEqual(r.status, 0);
      assert.match(r.stderr, /local-refusal/);
    });
  });
});
