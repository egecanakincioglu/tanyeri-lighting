// Tests for check-docs-language.ts: pure helpers, temporary docs trees and the real repository.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkDocs, hasTurkishText, isValidDirName, isValidFileName } from './check-docs-language.ts';

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
      '2026-10-12-f0-temel.md',
      '2026-10-27-revizyon.md',
      'git-workflow.md',
      'gelistirme-ortami.md',
      'logo.png',
    ]) {
      assert.equal(isValidFileName(n), true, n);
    }
  });
  test('invalid file names', () => {
    for (const n of [
      'Readme.md',
      'Vision.md',
      'gelistirme_ortami.md',
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
    assert.equal(isValidDirName('plans'), true);
    assert.equal(isValidDirName('f0-temel'), true);
    assert.equal(isValidDirName('Guides'), false);
    assert.equal(isValidDirName('kılavuz'), false);
    assert.equal(isValidDirName('a_b'), false);
  });
});

describe('Turkish heuristic', () => {
  test('every Turkish letter counts, in both cases', () => {
    for (const ch of 'çğıöşüÇĞİÖŞÜ') assert.equal(hasTurkishText(`plain text ${ch} plain`), true, ch);
  });
  test('code blocks and inline code are ignored', () => {
    const fence = '```';
    assert.equal(hasTurkishText(`English only.\n\n${fence}text\nçğıöşü kod\n${fence}\n`), false);
    assert.equal(hasTurkishText('English only.\n\n~~~\nÖzet\n~~~\n'), false);
    assert.equal(hasTurkishText('English only `Özet` here.'), false);
    assert.equal(hasTurkishText(`English only.\n${fence}\nunclosed Özet`), false);
    assert.equal(hasTurkishText(`${fence}\ncode\n${fence}\nBu satır Türkçe.`), true);
    assert.equal(hasTurkishText('Özet `code`'), true);
  });
  test('English text and other accented letters do not count', () => {
    assert.equal(hasTurkishText('This page is written in English only.'), false);
    assert.equal(hasTurkishText('Café déjà vu naïve'), false);
    assert.equal(hasTurkishText(''), false);
  });
});

describe('checkDocs', () => {
  test('a clean tree passes', () => {
    const dir = tree({
      'README.md': '# Doküman\n',
      'adr/0001-karar.md': 'Karar: kabul edildi, çünkü.\n',
      'journal/2026-10-12.md': 'Özet\n',
    });
    assert.deepEqual(checkDocs(dir), []);
  });
  test('an English page is reported', () => {
    const dir = tree({ 'guide.md': 'Everything here is English.\n', 'ok.md': 'Türkçe\n' });
    const problems = checkDocs(dir);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /docs\/guide\.md: no Turkish text/);
  });
  test('bad file and folder names are reported, nested paths included', () => {
    const dir = tree({ 'Guides/Setup_Notes.md': 'Türkçe\n', 'ok/Türkçe-ad.md': 'Türkçe\n' });
    const problems = checkDocs(dir);
    assert.ok(problems.some((p) => p.startsWith('docs/Guides/: folder name')));
    assert.ok(problems.some((p) => p.startsWith('docs/Guides/Setup_Notes.md: file name')));
    assert.ok(problems.some((p) => p.startsWith('docs/ok/Türkçe-ad.md: file name')));
  });
  test('non-markdown files only need a valid name', () => {
    const dir = tree({ 'assets/diagram.png': 'not text', 'assets/Bad Name.png': 'x' });
    const problems = checkDocs(dir);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /Bad Name\.png: file name/);
  });
});

describe('CLI', () => {
  const run = (...args: string[]) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' });
  test('exit 0 for a clean tree, 1 for violations, 2 for usage errors', () => {
    assert.equal(run('--docs', tree({ 'a.md': 'Türkçe\n' })).status, 0);
    const bad = run('--docs', tree({ 'a.md': 'English\n' }));
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /docs language: docs\/a\.md/);
    assert.equal(run('--docs').status, 2);
    assert.equal(run('--docs', path.join(root, 'does-not-exist')).status, 2);
  });
  test('the real docs/ folder of this repository passes', () => {
    const r = run();
    assert.equal(r.status, 0, r.stderr);
  });
});
