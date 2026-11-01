#!/usr/bin/env node
// Documentation language and naming rule:
//   - every file and folder under docs/ has an ASCII kebab-case name (README.md is the one uppercase exception;
//     date prefixes YYYY-MM-DD- and numbered ADR names NNNN- are plain kebab-case with digits);
//   - the documents are written in English: README.md, CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, releases/**/*.md
//     and docs/**/*.md contain none of the Turkish-only letters ğ Ğ ş Ş ı İ outside inline code and fenced code blocks.
//     The author's name is the one allowed exception (see ALLOWED).
// Paths git ignores (for example the local legacy guide) are skipped.
//
//   node tooling/scripts/check-docs-language.ts [--root <dir>]
//
// Exit codes: 0 ok, 1 violations, 2 usage error. Portable: Node only.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withoutGitIgnored } from './lib/git-ignored.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FILE_NAME = /^(README\.md|[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+)$/;
const TURKISH_ONLY = /[ğĞşŞıİ]/g;
const ROOT_FILES = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md'];
// Proper names that legitimately contain a Turkish-only letter.
const ALLOWED = ['Egecan Akıncıoğlu'];

/** True when the file name is allowed under docs/. */
export const isValidFileName = (name: string): boolean => FILE_NAME.test(name);
/** True when the folder name is allowed under docs/. */
export const isValidDirName = (name: string): boolean => DIR_NAME.test(name);
const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;
/** The text without fenced code blocks (an unclosed fence runs to the end) and inline code; line numbers are kept. */
export const stripCode = (text: string): string =>
  text.replace(FENCE, (block) => '\n'.repeat(block.split('\n').length - 1)).replace(/`[^`\n]*`/g, '');

/** The lines (1-based) that contain Turkish-only letters outside code and allowed names, with the letters found. */
export function findTurkishLetters(text: string): { line: number; letters: string }[] {
  let plain = stripCode(text);
  for (const name of ALLOWED) plain = plain.replaceAll(name, '');
  const found: { line: number; letters: string }[] = [];
  plain.split('\n').forEach((content, i) => {
    const letters = [...new Set(content.match(TURKISH_ONLY))];
    if (letters.length) found.push({ line: i + 1, letters: letters.join(' ') });
  });
  return found;
}

const listFiles = (root: string, rel: string, out: { rel: string; isDir: boolean }[]): void => {
  if (!existsSync(path.join(root, rel))) return;
  for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const relPath = `${rel}/${entry.name}`;
    out.push({ rel: relPath, isDir: entry.isDirectory() });
    if (entry.isDirectory()) listFiles(root, relPath, out);
  }
};

/** Problems found under `root`, as human readable strings (empty when everything is fine). */
export function checkDocs(root: string): string[] {
  const docs: { rel: string; isDir: boolean }[] = [];
  const releases: { rel: string; isDir: boolean }[] = [];
  listFiles(root, 'docs', docs);
  listFiles(root, 'releases', releases);
  const rootFiles = ROOT_FILES.filter((f) => existsSync(path.join(root, f))).map((rel) => ({ rel, isDir: false }));
  const entries = [...rootFiles, ...releases, ...docs];
  const kept = new Set(
    withoutGitIgnored(
      root,
      entries.map((e) => e.rel),
    ),
  );
  const problems: string[] = [];
  for (const { rel, isDir } of entries) {
    if (!kept.has(rel)) continue;
    const name = rel.slice(rel.lastIndexOf('/') + 1);
    const inDocs = rel.startsWith('docs/');
    if (isDir) {
      if (inDocs && !isValidDirName(name)) problems.push(`${rel}/: folder name must be ASCII kebab-case`);
      continue;
    }
    if (inDocs && !isValidFileName(name))
      problems.push(`${rel}: file name must be ASCII kebab-case (README.md is the only exception)`);
    if (!name.endsWith('.md')) continue;
    for (const { line, letters } of findTurkishLetters(readFileSync(path.join(root, rel), 'utf8'))) {
      problems.push(`${rel}:${line}: Turkish letter(s) ${letters}; documentation is written in English`);
    }
  }
  return problems;
}

export function main(argv: string[], defaultRoot: string = path.resolve(HERE, '..', '..')): number {
  const i = argv.indexOf('--root');
  if (i !== -1 && !argv[i + 1]) {
    process.stderr.write('check-docs-language: --root needs a directory\n');
    return 2;
  }
  const root = i !== -1 ? path.resolve(argv[i + 1]) : defaultRoot;
  if (!existsSync(root)) {
    process.stderr.write(`check-docs-language: ${root} does not exist\n`);
    return 2;
  }
  let problems: string[];
  try {
    problems = checkDocs(root);
  } catch (e) {
    process.stderr.write(`check-docs-language: ${(e as Error).message}\n`);
    return 2;
  }
  for (const p of problems) process.stderr.write(`docs language: ${p}\n`);
  process.stdout.write(`docs language: ${problems.length} problem(s)\n`);
  return problems.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
