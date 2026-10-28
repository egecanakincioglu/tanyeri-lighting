// Tests for check-site-audit-thresholds.ts: the pure comparison plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { compare, type Thresholds } from './check-site-audit-thresholds.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-site-audit-thresholds.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'audit-thr-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

const base: Thresholds = {
  categories: { performance: 90, seo: 92 },
  expected: 95,
  budgets: { scriptKB: 180, fontFiles: 2 },
};
const withChange = (change: Thresholds): Thresholds => ({ ...base, ...change });

describe('compare', () => {
  test('same values pass', () => assert.deepEqual(compare(base, base), []));
  test('raised scores and smaller budgets pass', () => {
    const head = withChange({
      categories: { performance: 95, seo: 92 },
      expected: 97,
      budgets: { scriptKB: 150, fontFiles: 2 },
    });
    assert.deepEqual(compare(base, head), []);
  });
  test('new keys pass', () => {
    const head = withChange({
      categories: { performance: 90, seo: 92, accessibility: 95 },
      budgets: { scriptKB: 180, fontFiles: 2, totalKB: 500 },
    });
    assert.deepEqual(compare(base, head), []);
  });
  test('a lowered category fails', () => {
    const head = withChange({ categories: { performance: 90, seo: 91 } });
    assert.deepEqual(compare(base, head), ['category seo dropped from 92 to 91']);
  });
  test('a removed category fails', () => {
    assert.deepEqual(compare(base, withChange({ categories: { performance: 90 } })), ['category seo was removed']);
  });
  test('a lowered expected fails', () => {
    assert.deepEqual(compare(base, withChange({ expected: 93 })), ['expected dropped from 95 to 93']);
  });
  test('a removed expected fails', () => {
    assert.deepEqual(compare(base, { ...base, expected: undefined }), ['expected was removed']);
  });
  test('a category below 90 fails even when the base was already below', () => {
    const low: Thresholds = { categories: { seo: 85 } };
    assert.deepEqual(compare(low, low), ['category seo is 85, below the 90 floor']);
  });
  test('an expected below 90 fails', () => {
    const low: Thresholds = { expected: 80 };
    assert.deepEqual(compare(low, low), ['expected is 80, below the 90 floor']);
  });
  test('a grown budget fails', () => {
    const head = withChange({ budgets: { scriptKB: 181, fontFiles: 2 } });
    assert.deepEqual(compare(base, head), ['budget scriptKB grew from 180 to 181']);
  });
  test('a removed budget fails', () => {
    assert.deepEqual(compare(base, withChange({ budgets: { scriptKB: 180 } })), ['budget fontFiles was removed']);
  });
});

describe('CLI', () => {
  const FILE = 'tooling/site-audit/thresholds.json';

  function sh(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  }
  function makeRepo() {
    const repo = path.join(root, `r${counter++}`);
    mkdirSync(path.join(repo, 'tooling', 'site-audit'), { recursive: true });
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
  const json = (change: Thresholds = {}) => JSON.stringify({ ...base, ...change });
  const run = (repo: string, from: string, to: string) =>
    spawnSync('node', [SCRIPT, '--base', from, '--head', to], { cwd: repo, encoding: 'utf8' });

  test('unchanged thresholds: passes', () => {
    const repo = makeRepo();
    const from = commit(repo, json());
    assert.equal(run(repo, from, commit(repo, null)).status, 0);
  });
  test('tightened thresholds: pass', () => {
    const repo = makeRepo();
    const from = commit(repo, json());
    const to = commit(repo, json({ expected: 97, budgets: { scriptKB: 100, fontFiles: 2 } }));
    assert.equal(run(repo, from, to).status, 0);
  });
  test('lowered score: fails', () => {
    const repo = makeRepo();
    const from = commit(repo, json());
    const r = run(repo, from, commit(repo, json({ expected: 92 })));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /expected dropped from 95 to 92/);
  });
  test('score below the floor: fails', () => {
    const repo = makeRepo();
    const from = commit(repo, json());
    const r = run(repo, from, commit(repo, json({ categories: { performance: 89, seo: 92 } })));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /below the 90 floor/);
  });
  test('grown budget: fails', () => {
    const repo = makeRepo();
    const from = commit(repo, json());
    const r = run(repo, from, commit(repo, json({ budgets: { scriptKB: 200, fontFiles: 2 } })));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /budget scriptKB grew/);
  });
  test('file missing in base: passes', () => {
    const repo = makeRepo();
    const from = commit(repo, null);
    assert.equal(run(repo, from, commit(repo, json({ expected: 10 }))).status, 0);
  });
  test('file deleted in head: fails', () => {
    const repo = makeRepo();
    const from = commit(repo, json());
    sh(repo, 'rm', '-q', FILE);
    sh(repo, 'commit', '-q', '-m', 'chore: remove');
    const r = run(repo, from, sh(repo, 'rev-parse', 'HEAD'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /was deleted/);
  });
  test('invalid JSON in head: usage error', () => {
    const repo = makeRepo();
    const from = commit(repo, json());
    assert.equal(run(repo, from, commit(repo, '{')).status, 2);
  });
  test('unknown ref: usage error', () => {
    const repo = makeRepo();
    const to = commit(repo, json());
    assert.equal(run(repo, 'deadbeef', to).status, 2);
  });
  test('missing arguments: usage error', () => {
    assert.equal(spawnSync('node', [SCRIPT], { encoding: 'utf8' }).status, 2);
  });
});
