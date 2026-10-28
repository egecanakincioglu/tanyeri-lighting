import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from '../scripts/lib/bash.ts';

const hooks = path.dirname(fileURLToPath(import.meta.url));
const hook = path.join(hooks, 'pre-push');
const bash = resolveBash() as string; // null only without a usable bash, and then every suite is skipped
const sha = 'a'.repeat(40);

describe('pre-push hook', { skip: bash ? false : 'bash not found' }, () => {
  const feed = (refs: string) => spawnSync(bash, [hook, 'origin', 'url'], { input: refs, encoding: 'utf8' });

  test('refuses a push to refs/heads/main', () => {
    const r = feed(`refs/heads/feat/x ${sha} refs/heads/main ${sha}\n`);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /pushing to main is not allowed/);
  });
  test('refuses when main is one of several refs', () => {
    assert.equal(
      feed(`refs/heads/a ${sha} refs/heads/a ${sha}\nrefs/heads/b ${sha} refs/heads/main ${sha}\n`).status,
      1,
    );
  });
  test('allows other branches, tags and similarly named refs', () => {
    assert.equal(feed(`refs/heads/feat/x ${sha} refs/heads/feat/x ${sha}\n`).status, 0);
    assert.equal(feed(`refs/heads/m ${sha} refs/heads/main-2 ${sha}\n`).status, 0);
    assert.equal(feed(`refs/tags/v1 ${sha} refs/tags/v1 ${sha}\n`).status, 0);
    assert.equal(feed('').status, 0);
  });

  test('end to end: git push to main is refused, a feature branch goes through', () => {
    const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'pre-push-')));
    try {
      const run = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' });
      const remote = path.join(dir, 'remote.git');
      const repo = path.join(dir, 'repo');
      mkdirSync(repo);
      run(dir, 'init', '-q', '--bare', remote);
      run(repo, 'init', '-q', '-b', 'main');
      run(repo, 'config', 'user.name', 't');
      run(repo, 'config', 'user.email', 't@t');
      run(repo, 'config', 'commit.gpgsign', 'false');
      writeFileSync(path.join(repo, 'a.txt'), 'x\n');
      run(repo, 'add', '-A');
      run(repo, 'commit', '-q', '-m', 'init');
      run(repo, 'remote', 'add', 'origin', remote);
      run(repo, 'config', 'core.hooksPath', hooks);
      const refused = run(repo, 'push', 'origin', 'main');
      assert.notEqual(refused.status, 0);
      assert.match(refused.stderr, /pushing to main is not allowed/);
      run(repo, 'switch', '-q', '-c', 'feat/x');
      const ok = run(repo, 'push', 'origin', 'feat/x');
      assert.equal(ok.status, 0, ok.stderr);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
