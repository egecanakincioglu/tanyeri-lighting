#!/usr/bin/env node
// Documentation language and naming rule:
//   - every file and folder under docs/ has an ASCII kebab-case name (README.md is the one uppercase exception;
//     date prefixes YYYY-MM-DD- and numbered ADR names NNNN- are plain kebab-case with digits);
//   - every docs/**/*.md contains Turkish text.
// The language check is a heuristic: at least one of the Turkish letters ç ğ ı ö ş ü Ç Ğ İ Ö Ş Ü must appear
// outside code blocks and inline code (code would otherwise let an English page pass).
// It cannot prove a page is entirely Turkish, but an English page without a single such letter is caught.
//
//   node tooling/scripts/check-docs-language.ts [--docs <dir>]
//
// Exit codes: 0 ok, 1 violations, 2 usage error. Portable: Node only.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FILE_NAME = /^(README\.md|[a-z0-9]+(-[a-z0-9]+)*\.[a-z0-9]+)$/;
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

/** True when the file name is allowed under docs/. */
export const isValidFileName = (name: string): boolean => FILE_NAME.test(name);
/** True when the folder name is allowed under docs/. */
export const isValidDirName = (name: string): boolean => DIR_NAME.test(name);
const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;
/** The text without fenced code blocks (an unclosed fence runs to the end) and inline code. */
export const stripCode = (text: string): string => text.replace(FENCE, '').replace(/`[^`\n]*`/g, '');
/** True when the text outside code contains at least one Turkish-specific letter. */
export const hasTurkishText = (text: string): boolean => TURKISH.test(stripCode(text));

/** Problems found under `docsDir`, as human readable strings (empty when everything is fine). */
export function checkDocs(docsDir: string): string[] {
  const problems: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!isValidDirName(entry.name)) problems.push(`docs/${relPath}/: folder name must be ASCII kebab-case`);
        walk(path.join(dir, entry.name), relPath);
      } else {
        if (!isValidFileName(entry.name))
          problems.push(`docs/${relPath}: file name must be ASCII kebab-case (README.md is the only exception)`);
        if (entry.name.endsWith('.md') && !hasTurkishText(readFileSync(path.join(dir, entry.name), 'utf8'))) {
          problems.push(`docs/${relPath}: no Turkish text found; documentation under docs/ is written in Turkish`);
        }
      }
    }
  };
  walk(docsDir, '');
  return problems;
}

export function main(argv: string[], defaultDocs: string = path.resolve(HERE, '..', '..', 'docs')): number {
  const i = argv.indexOf('--docs');
  if (i !== -1 && !argv[i + 1]) {
    process.stderr.write('check-docs-language: --docs needs a directory\n');
    return 2;
  }
  const docsDir = i !== -1 ? path.resolve(argv[i + 1]) : defaultDocs;
  let problems: string[];
  try {
    problems = checkDocs(docsDir);
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
