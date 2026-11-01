// Tests for check-docs-language.ts: pure helpers and temporary repository trees.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDocs, findTurkishLetters, isValidDirName, isValidFileName } from './check-docs-language.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'check-docs-language.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'docs-lang-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

function tree(files: Record<string, string>): string {
  const dir = path.join(root, `d${counter++}`);
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return dir;
}

describe('names', () => {
  test('valid file names', () => {
    for (const n of [
      'README.md',
      'vision.md',
      'roadmap.md',
      '2026-10-12.md',
      '0008-ci-cd.md',
      '2026-10-12-phase-0.md',
      'git-workflow.md',
      'development-setup.md',
      'logo.png',
    ]) {
      assert.equal(isValidFileName(n), true, n);
    }
  });
  test('invalid file names', () => {
    for (const n of [
      'Readme.md',
      'Vision.md',
      'development_setup.md',
      'geliştirme.md',
      'a b.md',
      '-a.md',
      'a-.md',
      'a--b.md',
      'a.MD',
      'notes',
      'UPPER.md',
      '.md',
    ]) {
      assert.equal(isValidFileName(n), false, n);
    }
  });
  test('folder names', () => {
    assert.equal(isValidDirName('guides'), true);
    assert.equal(isValidDirName('phase-0'), true);
    assert.equal(isValidDirName('Guides'), false);
    assert.equal(isValidDirName('kılavuz'), false);
    assert.equal(isValidDirName('a_b'), false);
  });
});

describe('Turkish letters', () => {
  test('every Turkish-only letter counts, in both cases', () => {
    for (const ch of 'ğĞşŞıİ') assert.equal(findTurkishLetters(`plain text ${ch} plain`).length, 1, ch);
  });
  test('letters shared with other languages do not count', () => {
    for (const ch of 'çÇöÖüÜ') assert.deepEqual(findTurkishLetters(`plain text ${ch} plain`), [], ch);
    assert.deepEqual(findTurkishLetters('Café déjà vu naïve über'), []);
    assert.deepEqual(findTurkishLetters(''), []);
  });
  test('code blocks and inline code are ignored', () => {
    const fence = '```';
    assert.deepEqual(findTurkishLetters(`English only.\n\n${fence}text\nğşı code\n${fence}\n`), []);
    assert.deepEqual(findTurkishLetters('English only.\n\n~~~\nözet ş\n~~~\n'), []);
    assert.deepEqual(findTurkishLetters('English only `ş` here.'), []);
    assert.deepEqual(findTurkishLetters(`English only.\n${fence}\nunclosed ş`), []);
    assert.equal(findTurkishLetters(`${fence}\ncode\n${fence}\nBu satır Türkçe.`).length, 1);
    assert.equal(findTurkishLetters('Bir `code` satır').length, 1);
  });
  test('the author name is allowed, other uses of its letters are not', () => {
    assert.deepEqual(findTurkishLetters('Written by Egecan Akıncıoğlu.'), []);
    assert.deepEqual(findTurkishLetters('Egecan Akıncıoğlu and Egecan Akıncıoğlu'), []);
    assert.equal(findTurkishLetters('Egecan Akıncıoğlu wrote the ışık page').length, 1);
    assert.equal(findTurkishLetters('Egecan Akıncı').length, 1);
  });
  test('reports the line number and the distinct letters, counting the lines of code blocks', () => {
    const fence = '```';
    const text = `Line one\n${fence}\ncode ş\n${fence}\nLine five ışı\nLine six\n`;
    assert.deepEqual(findTurkishLetters(text), [{ line: 5, letters: 'ı ş' }]);
  });
});

describe('checkDocs', () => {
  test('a clean tree passes', () => {
    const dir = tree({
      'README.md': '# Tanyeri\n',
      'CHANGELOG.md': 'All notable changes.\n',
      'releases/v0.1.0.md': 'Release notes by Egecan Akıncıoğlu.\n',
      'docs/README.md': '# Docs\n',
      'docs/adr/0001-decision.md': 'Decision: accepted, because of cost.\n',
    });
    assert.deepEqual(checkDocs(dir), []);
  });
  test('Turkish text is reported with file and line in every scope', () => {
    const dir = tree({
      'README.md': 'ok\nşu\n',
      'CONTRIBUTING.md': 'ok\n',
      'SECURITY.md': 'ı\n',
      'CHANGELOG.md': 'ok\nok\nİ\n',
      'releases/v0.1.0.md': 'ğ\n',
      'docs/guide.md': 'ok\nok\nok\nşş\n',
      'docs/sub/deep.md': 'Ş\n',
    });
    assert.deepEqual(checkDocs(dir).sort(), [
      'CHANGELOG.md:3: Turkish letter(s) İ; documentation is written in English',
      'README.md:2: Turkish letter(s) ş; documentation is written in English',
      'SECURITY.md:1: Turkish letter(s) ı; documentation is written in English',
      'docs/guide.md:4: Turkish letter(s) ş; documentation is written in English',
      'docs/sub/deep.md:1: Turkish letter(s) Ş; documentation is written in English',
      'releases/v0.1.0.md:1: Turkish letter(s) ğ; documentation is written in English',
    ]);
  });
  test('files outside the scope are not read', () => {
    const dir = tree({ 'notes/other.md': 'ş\n', 'src/readme.md': 'ş\n', 'docs/data.txt': 'ş\n' });
    assert.deepEqual(checkDocs(dir), []);
  });
  test('bad file and folder names under docs are reported, nested paths included', () => {
    const dir = tree({ 'docs/Guides/Setup_Notes.md': 'English\n', 'docs/ok/Adı.md': 'English\n' });
    const problems = checkDocs(dir);
    assert.ok(problems.some((p) => p.startsWith('docs/Guides/: folder name')));
    assert.ok(problems.some((p) => p.startsWith('docs/Guides/Setup_Notes.md: file name')));
    assert.ok(problems.some((p) => p.startsWith('docs/ok/Adı.md: file name')));
  });
  test('file names outside docs are not subject to the name rule', () => {
    const dir = tree({ 'releases/v0.1.0.md': 'English\n', 'CHANGELOG.md': 'English\n' });
    assert.deepEqual(checkDocs(dir), []);
  });
  test('non-markdown files only need a valid name', () => {
    const dir = tree({ 'docs/assets/diagram.png': 'not text', 'docs/assets/Bad Name.png': 'x' });
    const problems = checkDocs(dir);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Bad Name\.png: file name/);
  });
  test('a tree without any documents passes', () => {
    assert.deepEqual(checkDocs(tree({ 'package.json': '{}' })), []);
  });
});

describe('git-ignored paths', () => {
  const files = {
    'docs/README.md': '# Docs\n',
    'docs/legacy/Bad Name.md': 'Türkçe ş\n',
    'docs/legacy/Sub Dir/x.md': 'Türkçe ş\n',
  };
  const inRepo = (ignore: string, init = true) => {
    const dir = tree(files);
    writeFileSync(path.join(dir, '.gitignore'), ignore);
    if (init) assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
    return dir;
  };
  test('an ignored subfolder is skipped inside a git repository', () => {
    assert.deepEqual(checkDocs(inRepo('docs/legacy/\n')), []);
  });
  test('the same files are reported when they are not ignored', () => {
    const problems = checkDocs(inRepo('unrelated\n'));
    assert.ok(problems.some((p) => p.includes('docs/legacy/Bad Name.md: file name')));
    assert.ok(problems.some((p) => p.includes('docs/legacy/Bad Name.md:1: Turkish letter')));
    assert.ok(problems.some((p) => p.includes('docs/legacy/Sub Dir/: folder name')));
  });
  test('outside a git repository nothing is filtered', () => {
    assert.ok(checkDocs(inRepo('docs/legacy/\n', false)).length >= 3);
  });
});

describe('CLI', () => {
  const run = (...args: string[]) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  test('exit 0 for a clean tree, 1 for violations, 2 for usage errors', () => {
    assert.equal(run('--root', tree({ 'docs/a.md': 'English\n' })).status, 0);
    const bad = run('--root', tree({ 'docs/a.md': 'Türkçe ş\n' }));
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /docs language: docs\/a\.md:1: Turkish letter\(s\) ş/);
    assert.equal(run('--root').status, 2);
    assert.equal(run('--root', path.join(root, 'does-not-exist')).status, 2);
  });
});
