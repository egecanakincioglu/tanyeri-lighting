#!/usr/bin/env node
// Journal summary check, two rules for a pull request:
//   1. It changes the "Özet" part of at least one journal file, i.e. a line above the "## Commit günlüğü" heading.
//      The summary is the repository-level hand-off between devices and sessions; this keeps it current.
//   2. In every journal file it touches, each Özet subsection ("### Yapılanlar", "### Kararlar / öğrenilenler",
//      "### Yarım kalan / sıradaki") holds at least one bullet, so no section is silently left empty.
//
//   node tooling/scripts/check-journal-summary.mjs --base <sha> --head <sha>
//
// Exit codes: 0 ok, 1 rule violated, 2 usage or git error. Portable: Node only.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JOURNAL_FILE = /^docs\/journal\/\d{4}-\d{2}-\d{2}\.md$/;
const COMMIT_HEADING = /^## Commit günlüğü\s*$/;
export const SECTIONS = ['### Yapılanlar', '### Kararlar / öğrenilenler', '### Yarım kalan / sıradaki'];
const BULLET = /^[ \t]*[-*+][ \t]+\S/;

function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: 30000,
  });
  return {
    ok: !r.error && r.status === 0,
    out: r.stdout ?? '',
    err: (r.stderr ?? '') || (r.error ? String(r.error.message) : ''),
  };
}

/**
 * Parses `git diff -U0` output into { 'docs/journal/x.md': [{ start, count }] } (new-side line ranges).
 * A hunk with count 0 is a pure deletion that happened after line `start`.
 */
export function parseHunks(diffText) {
  const files = {};
  let current = null;
  for (const line of diffText.split(/\r?\n/)) {
    const f = /^\+\+\+ b\/(.+)$/.exec(line);
    if (f) {
      current = f[1];
      files[current] = [];
      continue;
    }
    if (/^\+\+\+ /.test(line)) {
      current = null; // deleted file (+++ /dev/null)
      continue;
    }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (h && current) files[current].push({ start: Number(h[1]), count: h[2] === undefined ? 1 : Number(h[2]) });
  }
  return files;
}

/** Line number (1-based) of the "## Commit günlüğü" heading in `text`, or Infinity when there is none. */
export function commitHeadingLine(text) {
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => COMMIT_HEADING.test(l));
  return i === -1 ? Infinity : i + 1;
}

/** True when any hunk adds, changes or removes a line above the heading at `headingLine`. */
export function touchesSummary(hunks, headingLine) {
  return hunks.some((h) => h.start < headingLine);
}

/** The Özet subsections of `text` that have no bullet (a missing subsection counts as empty). */
export function emptySections(text) {
  const lines = text.split(/\r?\n/);
  const end = commitHeadingLine(text) - 1;
  const summary = lines.slice(0, Number.isFinite(end) ? end : lines.length);
  return SECTIONS.filter((title) => {
    const start = summary.findIndex((l) => l.trimEnd() === title);
    if (start === -1) return true;
    for (let i = start + 1; i < summary.length && !/^#{1,6}[ \t]/.test(summary[i]); i++) {
      if (BULLET.test(summary[i])) return false;
    }
    return true;
  });
}

/**
 * Journal files changed in base...head: { touched: every added or modified file, summaryChanged: those whose
 * Özet part changed, empty: { file: [missing-bullet subsections] } }. Throws on git errors.
 */
export function inspect({ base, head, cwd = process.cwd() }) {
  const diff = git(
    ['diff', '-U0', '--no-color', '--no-renames', '--diff-filter=AM', `${base}...${head}`, '--', ':(top)docs/journal'],
    cwd,
  );
  if (!diff.ok) throw new Error(`git diff failed: ${diff.err.trim()}`);
  const touched = [];
  const summaryChanged = [];
  const empty = {};
  for (const [file, hunks] of Object.entries(parseHunks(diff.out))) {
    if (!JOURNAL_FILE.test(file)) continue;
    const show = git(['show', `${head}:${file}`], cwd);
    if (!show.ok) throw new Error(`cannot read ${file} at ${head}: ${show.err.trim()}`);
    touched.push(file);
    if (touchesSummary(hunks, commitHeadingLine(show.out))) summaryChanged.push(file);
    const missing = emptySections(show.out);
    if (missing.length) empty[file] = missing;
  }
  return { touched, summaryChanged, empty };
}

export function main(argv, cwd = process.cwd()) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const base = get('--base');
  const head = get('--head');
  if (!base || !head) {
    process.stderr.write('check-journal-summary: --base <sha> and --head <sha> are required\n');
    return 2;
  }
  let result;
  try {
    result = inspect({ base, head, cwd });
  } catch (e) {
    process.stderr.write(`check-journal-summary: ${e.message}\n`);
    return 2;
  }
  let status = 0;
  if (!result.summaryChanged.length) {
    process.stderr.write(
      'journal summary: this pull request does not change the "Özet" part of any docs/journal/YYYY-MM-DD.md ' +
        '(the lines above "## Commit günlüğü"). Update "Yapılanlar", "Kararlar / öğrenilenler" and "Yarım kalan / sıradaki" ' +
        'so the repository-level hand-off is current after the merge.\n',
    );
    status = 1;
  }
  for (const [file, sections] of Object.entries(result.empty)) {
    process.stderr.write(`journal summary: ${file} has no bullet under: ${sections.join(', ')}\n`);
    status = 1;
  }
  if (status === 0) process.stdout.write(`journal summary: updated in ${result.summaryChanged.join(', ')}\n`);
  return status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
