import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from './lib/bash.ts';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-journal-entry.sh');
const bash = resolveBash() as string; // null only without a usable bash, and then every suite is skipped
const header = 'feat(cart): add stepper';
const today = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();

// files: path -> content, staged in a fresh repo with an initial commit holding an empty journal folder
type Git = (...args: string[]) => SpawnSyncReturns<string>;

const withRepo = <T>(files: Record<string, string>, fn: (dir: string, git: Git) => T): T => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'journal-entry-')));
  try {
    const git: Git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    writeFileSync(path.join(dir, 'README.md'), 'x\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'init');
    for (const [file, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      writeFileSync(path.join(dir, file), content);
    }
    git('add', '-A');
    return fn(dir, git);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const sh = (dir: string, ...args: string[]) => spawnSync(bash, [script, ...args], { cwd: dir, encoding: 'utf8' });
const line = `- \`${header}\` - Sepete adet butonunu ekledim.\n`;

describe('check-journal-entry.sh', { skip: bash ? false : 'bash not found' }, () => {
  describe('--staged', () => {
    test('passes with the header in backticks in today\'s journal', () => {
      withRepo({ [`docs/journal/${today}.md`]: `# ${today}\n\n${line}` }, (dir) => {
        assert.equal(sh(dir, '--staged', header).status, 0);
      });
    });
    test('fails without any journal change', () => {
      withRepo({ 'a.txt': 'x\n' }, (dir) => {
        const r = sh(dir, '--staged', header);
        assert.equal(r.status, 1);
        assert.match(r.stderr, /journal/);
      });
    });
    test('fails when the header is not in backticks', () => {
      withRepo({ [`docs/journal/${today}.md`]: `- ${header} - x\n` }, (dir) => {
        assert.equal(sh(dir, '--staged', header).status, 1);
      });
    });
    test('fails when the line is for a different header', () => {
      withRepo({ [`docs/journal/${today}.md`]: '- `fix: other` - x\n' }, (dir) => {
        assert.equal(sh(dir, '--staged', header).status, 1);
      });
    });
    test('fails when the journal file is not today\'s', () => {
      withRepo({ 'docs/journal/2001-01-01.md': line }, (dir) => {
        assert.equal(sh(dir, '--staged', header).status, 1);
      });
    });
    test('merge headers are exempt', () => {
      withRepo({ 'a.txt': 'x\n' }, (dir) => {
        assert.equal(sh(dir, '--staged', "Merge branch 'x' into y").status, 0);
      });
    });
    test('requires a header argument', () => {
      withRepo({}, (dir) => assert.notEqual(sh(dir, '--staged').status, 0));
    });
  });

  describe('--commit', () => {
    const commit = (dir: string, git: Git, extra: string[] = []) => {
      git('commit', '-q', '-m', `${header}\n\nbody`, ...extra);
      return git('rev-parse', 'HEAD').stdout.trim();
    };
    test('passes for a commit that added the line to its day\'s journal', () => {
      withRepo({ [`docs/journal/${today}.md`]: line }, (dir, git) => {
        assert.equal(sh(dir, '--commit', commit(dir, git)).status, 0);
      });
    });
    test('uses the commit day, not today', () => {
      withRepo({ 'docs/journal/2001-01-01.md': line }, (dir, git) => {
        const sha = commit(dir, git, ['--date=2001-01-01T12:00:00']);
        assert.equal(sh(dir, '--commit', sha).status, 0);
      });
    });
    test('fails for a commit without a journal line', () => {
      withRepo({ 'a.txt': 'x\n' }, (dir, git) => {
        assert.equal(sh(dir, '--commit', commit(dir, git)).status, 1);
      });
    });
    test('merge commits are exempt', () => {
      withRepo({}, (dir, git) => {
        git('switch', '-q', '-c', 'side');
        writeFileSync(path.join(dir, 'b.txt'), 'b\n');
        git('add', '-A');
        git('commit', '-q', '-m', 'side');
        git('switch', '-q', '-');
        writeFileSync(path.join(dir, 'c.txt'), 'c\n');
        git('add', '-A');
        git('commit', '-q', '-m', 'main work');
        git('merge', '--no-ff', '-q', '-m', "Merge branch 'side'", 'side');
        assert.equal(sh(dir, '--commit', 'HEAD').status, 0);
      });
    });
  });

  test('unknown mode exits 2', () => {
    assert.equal(spawnSync(bash, [script, '--nope'], { encoding: 'utf8' }).status, 2);
  });
});
