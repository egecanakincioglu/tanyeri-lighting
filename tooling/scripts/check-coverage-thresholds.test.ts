// Tests for check-coverage-thresholds.ts: the pure comparison plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compare } from './check-coverage-thresholds.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-coverage-thresholds.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'cov-thr-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

describe('compare', () => {
  const base = { 'src/lib/**': { lines: 80 } };
  test('same values pass', () => assert.deepEqual(compare(base, base), []));
  test('a raised value passes', () => assert.deepEqual(compare(base, { 'src/lib/**': { lines: 90 } }), []));
  test('a new glob and a new metric pass', () => {
    assert.deepEqual(compare(base, { 'src/lib/**': { lines: 80, branches: 70 }, 'src/server/**': { lines: 80 } }), []);
  });
  test('a lowered value fails', () => {
    assert.deepEqual(compare(base, { 'src/lib/**': { lines: 79 } }), ['src/lib/** lines dropped from 80 to 79']);
  });
  test('a removed glob fails', () => assert.deepEqual(compare(base, {}), ['src/lib/** was removed']));
  test('a removed metric fails', () => {
    assert.deepEqual(compare(base, { 'src/lib/**': {} }), ['src/lib/** lines was removed']);
  });
});

describe('CLI', () => {
  const FILE = 'tooling/coverage-thresholds.json';

  function sh(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  }
  function makeRepo() {
    const repo = path.join(root, `r${counter++}`);
    mkdirSync(path.join(repo, 'tooling'), { recursive: true });
    sh(repo, 'init', '-q', '-b', 'main');
    for (const [k, v] of [
      ['user.name', 'tester'],
      ['user.email', 'tester@example.com'],
      ['commit.gpgsign', 'false'],
    ])
      sh(repo, 'config', k, v);
    return repo;
  }
  // Commits the thresholds file with the given content, or an unrelated file when content is null.
  function commit(repo: string, content: string | null): string {
    if (content !== null) writeFileSync(path.join(repo, FILE), content);
    else writeFileSync(path.join(repo, 'other.txt'), String(counter++));
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: change');
    return sh(repo, 'rev-parse', 'HEAD');
  }
  const json = (lines: number) => JSON.stringify({ 'src/lib/**': { lines } });
  const run = (repo: string, base: string, head: string) =>
    spawnSync('node', [SCRIPT, '--base', base, '--head', head], { cwd: repo, encoding: 'utf8' });

  test('unchanged thresholds: passes', () => {
    const repo = makeRepo();
    const base = commit(repo, json(80));
    const head = commit(repo, null);
    assert.equal(run(repo, base, head).status, 0);
  });
  test('raised threshold: passes', () => {
    const repo = makeRepo();
    const base = commit(repo, json(80));
    const head = commit(repo, json(85));
    assert.equal(run(repo, base, head).status, 0);
  });
  test('lowered threshold: fails', () => {
    const repo = makeRepo();
    const base = commit(repo, json(80));
    const head = commit(repo, json(70));
    const r = run(repo, base, head);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /src\/lib\/\*\* lines dropped from 80 to 70/);
  });
  test('file missing in base: passes', () => {
    const repo = makeRepo();
    const base = commit(repo, null);
    const head = commit(repo, json(10));
    assert.equal(run(repo, base, head).status, 0);
  });
  test('file deleted in head: fails', () => {
    const repo = makeRepo();
    const base = commit(repo, json(80));
    sh(repo, 'rm', '-q', FILE);
    sh(repo, 'commit', '-q', '-m', 'chore: remove');
    const r = run(repo, base, sh(repo, 'rev-parse', 'HEAD'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /was deleted/);
  });
  test('invalid JSON in head: usage error', () => {
    const repo = makeRepo();
    const base = commit(repo, json(80));
    const head = commit(repo, '{');
    assert.equal(run(repo, base, head).status, 2);
  });
  test('unknown ref: usage error', () => {
    const repo = makeRepo();
    const head = commit(repo, json(80));
    assert.equal(run(repo, 'deadbeef', head).status, 2);
  });
  test('missing arguments: usage error', () => {
    const r = spawnSync('node', [SCRIPT], { encoding: 'utf8' });
    assert.equal(r.status, 2);
  });
});
