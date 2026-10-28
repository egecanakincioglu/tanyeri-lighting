// Tests for check-forbidden-terms.sh against a throwaway git repository (files are only added to the index).
import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from './lib/bash.ts';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-forbidden-terms.sh');
const bash = resolveBash() as string; // null only without a usable bash, and then every suite is skipped
// built from pieces so this file does not match its own check
const names = [
  ['cl', 'aude'],
  ['anth', 'ropic'],
  ['open', 'ai'],
  ['chat', 'gpt'],
  ['gp', 't-4'],
  ['gem', 'ini'],
  ['co', 'pilot'],
  ['impe', 'ccable'],
  ['pony', 'tail'],
].map((p) => p.join(''));

// the old client brand, built from pieces for the same reason
const brand = ['af', 'ra'].join('');
const brandCases = [brand, brand.toUpperCase(), `${brand} Lighting`, `${brand}-main`, `${brand}_signing`, `${brand}lighting`, `${brand}.png`];
const harmless = ['afr', 'aid'].join(''); // contains the brand but is an ordinary word
const harmlessTr = [['s', brand].join(''), ['s', brand, 'n'].join('')]; // Turkish words that contain it

const withRepo = <T>(files: Record<string, string>, fn: (dir: string, git: (...args: string[]) => SpawnSyncReturns<string>) => T): T => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'forbidden-terms-')));
  try {
    const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
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
const run = (mode: string, files: Record<string, string>) =>
  withRepo(files, (dir, git) => {
    if (mode === '--all') git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x');
    const r = spawnSync(bash, [script, mode], { cwd: dir, encoding: 'utf8' });
    return { code: r.status, err: r.stderr };
  });
const text = (input: string) => {
  const r = spawnSync(bash, [script, '--text', '-'], { input, encoding: 'utf8' });
  return { code: r.status, err: r.stderr };
};

describe('check-forbidden-terms', { skip: bash ? false : 'bash not found' }, () => {
  for (const mode of ['--staged', '--all']) {
    describe(mode, () => {
      test('clean files pass', () => assert.equal(run(mode, { 'a.txt': 'hello gem and pilot\n' }).code, 0));
      for (const name of names) {
        test(`${name} is caught in content`, () => {
          const r = run(mode, { 'a.txt': `uses ${name.toUpperCase()}\n` });
          assert.equal(r.code, 1);
          assert.match(r.err, /forbidden term in (staged|tracked) content/);
        });
      }
      test('a term in a path is caught', () => {
        const r = run(mode, { [`${names[8]}/notes.txt`]: 'x\n' });
        assert.equal(r.code, 1);
        assert.match(r.err, /forbidden term in path/);
      });
      for (const c of brandCases) {
        test(`old brand "${c}" is caught in content`, () => {
          const r = run(mode, { 'a.txt': `built for ${c} once\n` });
          assert.equal(r.code, 1);
          assert.match(r.err, /old brand name in (staged|tracked) content/);
        });
      }
      test('old brand in a path is caught', () => {
        const r = run(mode, { [`public/${brand}-favicon.png`]: 'x\n' });
        assert.equal(r.code, 1);
        assert.match(r.err, /old brand name in path/);
      });
      test('ordinary words that contain the brand pass', () => {
        const words = [harmless, ...harmlessTr, harmless.toUpperCase()].join(' ');
        assert.equal(run(mode, { 'a.txt': `${words}\n`, [`${harmlessTr[0]}.txt`]: 'x\n' }).code, 0);
      });
      test('the root README.md may name the old brand in its content', () => {
        assert.equal(run(mode, { 'README.md': `Once called "${brand} Lighting".\n` }).code, 0);
      });
      test('the README exception does not cover other files or other forbidden terms', () => {
        const cases: Record<string, string>[] = [
          { 'README.md': 'ok\n', 'docs/README.md': `${brand} Lighting\n` },
          { 'README.md': 'ok\n', 'NOTES.md': `${brand} Lighting\n` },
          { 'README.md': `${brand} and ${names[0]}\n` },
        ];
        for (const files of cases) assert.equal(run(mode, files).code, 1, JSON.stringify(files));
      });
      test('.mcp.json is rejected at the root and in a subfolder', () => {
        for (const p of ['.mcp.json', 'apps/web/.mcp.json']) {
          const r = run(mode, { [p]: '{}\n' });
          assert.equal(r.code, 1);
          assert.match(r.err, /assistant tool config must stay local/);
        }
      });
      test('mcp.json without the dot and .mcp.json.example pass', () => {
        assert.equal(run(mode, { 'mcp.json': '{}\n', '.mcp.json.example': '{}\n' }).code, 0);
      });
    });
  }

  describe('--text', () => {
    test('clean text passes', () => assert.equal(text('feat: add cart\n\nbody\n').code, 0));
    test('comment lines are scanned too', () => {
      for (const input of [`feat: x\n# ${names[0]}\n`, 'feat: x\n\n## Generated with a tool\n', `## ${names[3]} notes\n`]) {
        assert.equal(text(input).code, 1, input);
      }
    });
    test('git comment template lines without forbidden words pass', () => {
      assert.equal(text('feat: x\n\nbody\n\n# Please enter the commit message\n#\n# On branch ci/x\n').code, 0);
    });
    test('everything after the scissors line is ignored, before it is not', () => {
      const cut = '# ------------------------ >8 ------------------------';
      assert.equal(text(`feat: x\n\nbody\n${cut}\ndiff mentions ${names[0]}\n`).code, 0);
      assert.equal(text(`feat: x\n\n${names[0]}\n${cut}\nfine\n`).code, 1);
    });
    for (const c of brandCases) {
      test(`old brand "${c}" is rejected`, () => {
        const r = text(`feat: x\n\nquotes the README: ${c}\n`);
        assert.equal(r.code, 1);
        assert.match(r.err, /old brand name in text/);
      });
    }
    test('ordinary words that contain the brand pass', () => {
      assert.equal(text(`feat: x\n\n${harmless} ${harmlessTr.join(' ')}\n`).code, 0);
    });
    for (const name of names) {
      test(`${name} is rejected`, () => {
        const r = text(`feat: x\n\nmentions ${name}\n`);
        assert.equal(r.code, 1);
        assert.match(r.err, /forbidden term in text/);
      });
    }
    test('attribution is rejected', () => {
      const lines = [
        ['Co-Authored', 'By: A <a@b.c>'].join('-'),
        'Generated with a tool',
        'generated by a tool',
        String.fromCodePoint(0x1f916),
      ];
      for (const line of lines) {
        const r = text(`feat: x\n\n${line}\n`);
        assert.equal(r.code, 1, line);
        assert.match(r.err, /attribution line in text/);
      }
    });
    test('reads a file argument', () => {
      withRepo({ 'MSG': `feat: x\n\n${names[0]}\n` }, (dir) => {
        const r = spawnSync(bash, [script, '--text', 'MSG'], { cwd: dir, encoding: 'utf8' });
        assert.equal(r.status, 1);
      });
    });
  });

  test('unknown mode exits 2', () => {
    assert.equal(spawnSync(bash, [script, '--nope'], { encoding: 'utf8' }).status, 2);
  });
});
