// Tests for check-journal-coverage.ts. Real temporary git repositories; nothing is mocked.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { detectBaseline, findUncovered } from './check-journal-coverage.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-journal-coverage.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'journal-cov-'));
let counter = 0;

function sh(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function write(repo: string, rel: string, text: string): void {
  const file = path.join(repo, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// A repository with one pre-journal commit. `commit` adds commits; `startJournal` makes the baseline commit.
function makeRepo() {
  const repo = path.join(root, `r${counter++}`);
  mkdirSync(repo, { recursive: true });
  sh(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [
    ['user.name', 'tester'],
    ['user.email', 'tester@example.com'],
    ['commit.gpgsign', 'false'],
  ])
    sh(repo, 'config', k, v);
  write(repo, 'README.md', 'x\n');
  sh(repo, 'add', '-A');
  sh(repo, 'commit', '-q', '-m', 'chore: before the journal');
  let n = 0;
  const commit = (header: string, journalLine?: string) => {
    write(repo, `f${n++}.txt`, `${n}\n`);
    if (journalLine !== undefined)
      write(repo, 'docs/journal/2026-10-12.md', `# 2026-10-12\n\n## Commit günlüğü\n\n${journalLine}\n`);
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', header);
    return sh(repo, 'rev-parse', 'HEAD');
  };
  const startJournal = (header: string, journalLine?: string) => {
    write(repo, 'docs/journal/README.md', '# Günlük\n');
    return commit(header, journalLine);
  };
  return { repo, commit, startJournal };
}

const cli = (repo: string, ...extra: string[]) => {
  const r = spawnSync('node', [SCRIPT, ...extra], { cwd: repo, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

after(() => rmSync(root, { recursive: true, force: true }));

describe('journal coverage', () => {
  test('the baseline is the first commit that added docs/journal/README.md', () => {
    const { repo, commit, startJournal } = makeRepo();
    const base = startJournal('docs(journal): add journal', '- `docs(journal): add journal` — Eklendi.');
    commit('feat(core): add thing', '- `feat(core): add thing` — Eklendi.');
    assert.equal(detectBaseline({ root: repo }), base);
  });

  test('the baseline commit itself is checked', () => {
    const { repo, startJournal } = makeRepo();
    startJournal('docs(journal): add journal');
    const missing = findUncovered({ root: repo });
    assert.deepEqual(
      missing.map((m) => m.header),
      ['docs(journal): add journal'],
    );
  });

  test('every commit covered: exit 0', () => {
    const { repo, commit, startJournal } = makeRepo();
    startJournal('docs(journal): add journal');
    commit('feat(core): add thing', '- `docs(journal): add journal` — A.\n- `feat(core): add thing` — B.');
    assert.deepEqual(findUncovered({ root: repo }), []);
    const r = cli(repo);
    assert.equal(r.code, 0);
    assert.match(r.out, /every commit has its journal line/);
  });

  test('commits before the baseline are out of scope', () => {
    const { repo, startJournal } = makeRepo();
    startJournal('docs(journal): add journal', '- `docs(journal): add journal` — A.');
    assert.deepEqual(findUncovered({ root: repo }), []);
  });

  test('a commit without a journal line is reported by sha and header: exit 1', () => {
    const { repo, commit, startJournal } = makeRepo();
    startJournal('docs(journal): add journal', '- `docs(journal): add journal` — A.');
    commit('ci: bump actions/checkout from 4 to 7 in the actions group');
    const missing = findUncovered({ root: repo });
    assert.equal(missing.length, 1);
    assert.equal(missing[0].header, 'ci: bump actions/checkout from 4 to 7 in the actions group');
    assert.match(missing[0].sha, /^[0-9a-f]{40}$/);
    const r = cli(repo);
    assert.equal(r.code, 1);
    assert.ok(r.err.includes('`ci: bump actions/checkout from 4 to 7 in the actions group`'));
    assert.ok(r.err.includes(missing[0].sha.slice(0, 9)));
  });

  test('the header must be in backticks, not just mentioned', () => {
    const { repo, startJournal } = makeRepo();
    startJournal('docs(journal): add journal', '- docs(journal): add journal — backtick yok.');
    assert.equal(findUncovered({ root: repo }).length, 1);
  });

  test('merge commits are ignored', () => {
    const { repo, commit, startJournal } = makeRepo();
    startJournal('docs(journal): add journal', '- `docs(journal): add journal` — A.');
    sh(repo, 'switch', '-q', '-c', 'feat/x');
    commit('feat(core): add thing', '- `docs(journal): add journal` — A.\n- `feat(core): add thing` — B.');
    sh(repo, 'switch', '-q', 'main');
    sh(repo, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #9 from x/feat/x', 'feat/x');
    assert.deepEqual(findUncovered({ root: repo }), []);
  });

  test('the journal is read from the ref by default and from the working tree with --worktree', () => {
    const { repo, startJournal } = makeRepo();
    startJournal('docs(journal): add journal');
    write(repo, 'docs/journal/2026-10-12.md', '- `docs(journal): add journal` — Çalışma ağacında.\n');
    assert.equal(findUncovered({ root: repo }).length, 1, 'uncommitted journal text does not count for a ref');
    assert.deepEqual(findUncovered({ root: repo, worktree: true }), []);
    assert.equal(cli(repo).code, 1);
    assert.equal(cli(repo, '--worktree').code, 0);
  });

  test('--ref limits the commits that are checked', () => {
    const { repo, commit, startJournal } = makeRepo();
    const first = startJournal('docs(journal): add journal', '- `docs(journal): add journal` — A.');
    commit('feat(core): second');
    assert.equal(cli(repo, '--ref', first).code, 0);
    assert.equal(cli(repo, '--ref', 'HEAD').code, 1);
  });

  test('a line in any journal file counts', () => {
    const { repo, commit, startJournal } = makeRepo();
    startJournal('docs(journal): add journal', '- `docs(journal): add journal` — A.');
    commit('feat(core): add thing');
    write(repo, 'docs/journal/2026-10-11.md', '- `feat(core): add thing` — Dünkü dosyada.\n');
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'docs(journal): add older line');
    assert.deepEqual(
      findUncovered({ root: repo }).map((m) => m.header),
      ['docs(journal): add older line'],
    );
  });

  test('no journal README in the history is an error (exit 2), never a silent pass', () => {
    const { repo } = makeRepo();
    assert.throws(() => detectBaseline({ root: repo }), /no commit adds docs\/journal\/README\.md/);
    const r = cli(repo);
    assert.equal(r.code, 2);
    assert.match(r.err, /no baseline/);
  });

  test('unknown arguments are rejected', () => {
    const { repo, startJournal } = makeRepo();
    startJournal('docs(journal): add journal');
    assert.equal(cli(repo, '--nope').code, 2);
  });
});
