// Tests for check-roadmap-update.ts. Pure decision tests plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluate, naReason, roadmapFiles } from './check-roadmap-update.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-roadmap-update.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'roadmap-test-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

describe('which files count', () => {
  test('the roadmap and plan files do; plan README, other docs and look-alikes do not', () => {
    assert.deepEqual(
      roadmapFiles([
        'docs/roadmap.md',
        'docs/plans/2026-10-27-revizyon.md',
        'docs/plans/README.md',
        'docs/vision.md',
        'docs/plans/sub/x.md',
        'src/docs/roadmap.md',
        'README.md',
      ]),
      ['docs/roadmap.md', 'docs/plans/2026-10-27-revizyon.md'],
    );
  });
});

describe('opt-out line', () => {
  test('accepts a hyphen with a reason, anywhere on its own line', () => {
    assert.equal(naReason('Roadmap: n/a - tooling only'), 'tooling only');
    assert.equal(naReason('intro\n\nRoadmap: n/a - reason here\n\nmore'), 'reason here');
    assert.equal(naReason('Roadmap: n/a - reason\r\nnext line'), 'reason');
  });
  test('rejects a missing, empty or placeholder reason and other separators', () => {
    assert.equal(naReason('Roadmap: n/a'), null);
    assert.equal(naReason('<!-- Roadmap: n/a - example -->'), null);
    assert.equal(naReason('<!<!---->--\nRoadmap: n/a - hidden\n-->'), null);
    assert.equal(naReason('<!-- never closed\nRoadmap: n/a - hidden'), null);
    assert.equal(naReason('<!-- a -->\nRoadmap: n/a - visible <!-- b -->'), 'visible');
    assert.equal(naReason('Roadmap: n/a - real\n<!-- never closed'), 'real');
    assert.equal(naReason('Roadmap: n/a -'), null);
    assert.equal(naReason('Roadmap: n/a -   '), null);
    assert.equal(naReason('Roadmap: n/a - <reason>'), null);
    assert.equal(naReason('Roadmap: n/a — long dash'), null);
    assert.equal(naReason('Roadmap: done'), null);
    assert.equal(naReason(''), null);
    assert.equal(naReason(undefined), null);
  });
  test('the line must start a line: prose and list items do not count', () => {
    assert.equal(naReason('see Roadmap: n/a - nope'), null);
    assert.equal(naReason('- [ ] Roadmap: n/a - nope'), null);
  });
  test('text inside HTML comments (the template instructions) does not count', () => {
    assert.equal(naReason('<!--\nRoadmap: n/a - example\n-->'), null);
    assert.equal(naReason('<!-- Roadmap: n/a - example -->\nRoadmap: n/a - real reason'), 'real reason');
  });
});

describe('decision', () => {
  test('a roadmap or plan change passes without any line', () => {
    assert.equal(evaluate({ changedFiles: ['a.txt', 'docs/roadmap.md'], body: '' }).ok, true);
    assert.equal(evaluate({ changedFiles: ['docs/plans/2026-10-27-revizyon.md'], body: undefined }).ok, true);
  });
  test('no change and no opt-out fails with instructions', () => {
    const r = evaluate({ changedFiles: ['tooling/x.mjs', 'docs/journal/2026-10-12.md'], body: 'no marker' });
    assert.equal(r.ok, false);
    assert.match(r.message, /Roadmap: n\/a - <reason>/);
  });
  test('a valid opt-out passes', () => {
    assert.equal(evaluate({ changedFiles: ['tooling/x.mjs'], body: 'Roadmap: n/a - internal refactor' }).ok, true);
  });
  test('an unfilled placeholder fails', () => {
    assert.equal(evaluate({ changedFiles: ['tooling/x.mjs'], body: 'Roadmap: n/a - <reason>' }).ok, false);
  });
});

describe('CLI', () => {
  function sh(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  }
  function makeRepo(changed: string[]) {
    const repo = path.join(root, `r${counter++}`);
    mkdirSync(repo, { recursive: true });
    sh(repo, 'init', '-q', '-b', 'main');
    for (const [k, v] of [
      ['user.name', 'tester'],
      ['user.email', 'tester@example.com'],
      ['commit.gpgsign', 'false'],
    ])
      sh(repo, 'config', k, v);
    writeFileSync(path.join(repo, 'a.txt'), 'a\n');
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: base');
    const base = sh(repo, 'rev-parse', 'HEAD');
    sh(repo, 'switch', '-q', '-c', 'feat/x');
    for (const f of changed) {
      mkdirSync(path.dirname(path.join(repo, f)), { recursive: true });
      writeFileSync(path.join(repo, f), 'changed\n');
    }
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: change');
    return { repo, base, head: sh(repo, 'rev-parse', 'HEAD') };
  }
  const run = (repo: string, base: string, head: string, body?: string) =>
    spawnSync('node', [SCRIPT, '--base', base, '--head', head], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, PR_BODY: body ?? '' },
    });

  test('exit 0 when the roadmap changed', () => {
    const { repo, base, head } = makeRepo(['docs/roadmap.md']);
    assert.equal(run(repo, base, head).status, 0);
  });
  test('exit 0 when a plan changed', () => {
    const { repo, base, head } = makeRepo(['docs/plans/2026-10-27-revizyon.md']);
    assert.equal(run(repo, base, head).status, 0);
  });
  test('exit 1 without roadmap change and without the line', () => {
    const { repo, base, head } = makeRepo(['b.txt']);
    const r = run(repo, base, head, 'just a description');
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Roadmap: n\/a/);
  });
  test('exit 0 with the opt-out line in the PR body', () => {
    const { repo, base, head } = makeRepo(['b.txt']);
    assert.equal(run(repo, base, head, '## Summary\n\nRoadmap: n/a - tooling only\n').status, 0);
  });
  test('the body is data: shell metacharacters in it do nothing', () => {
    const { repo, base, head } = makeRepo(['b.txt']);
    const r = run(repo, base, head, 'Roadmap: n/a - $(touch pwned) `touch pwned` ; rm -rf x');
    assert.equal(r.status, 0);
  });
  test('exit 2 on missing arguments or unknown commits', () => {
    const { repo, head } = makeRepo(['b.txt']);
    assert.equal(spawnSync('node', [SCRIPT], { cwd: repo, encoding: 'utf8' }).status, 2);
    assert.equal(run(repo, 'deadbeef', head).status, 2);
  });
});
