#!/usr/bin/env node
// Journal coverage check: every non-merge commit in <baseline>..<ref> must have its header, in backticks,
// somewhere in docs/journal/*.md at <ref>. The per-commit hook and the per-PR check only see one pull request;
// this check looks at the whole history, so a commit that slipped through (typically a bot commit) is caught later.
//
//   node tooling/scripts/check-journal-coverage.mjs [--ref <ref>] [--worktree]
//
// The baseline is detected: it is the first commit that added docs/journal/README.md, and that commit is checked
// too. The commits before it predate the journal and are out of scope.
// --ref        commits up to this ref are checked, and the journal is read from this ref (default HEAD)
// --worktree   read the journal files from the working tree instead (used by the session context script)
// Exit codes: 0 all covered, 1 missing journal lines, 2 usage or git error.
// Portable: Node only, no shell features.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// :(top) makes the pathspec independent of the directory the script is started from.
const JOURNAL_MARKER = ':(top)docs/journal/README.md';
const JOURNAL_FILE = /^docs\/journal\/[^/]+\.md$/;

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

/** The first commit (oldest) reachable from `ref` that added docs/journal/README.md. Throws when there is none. */
export function detectBaseline({ root = process.cwd(), ref = 'HEAD' } = {}) {
  const r = git(['log', '--diff-filter=A', '--reverse', '--format=%H', ref, '--', JOURNAL_MARKER], root);
  if (!r.ok) throw new Error(`git log failed: ${r.err.trim()}`);
  const first = r.out.split(/\r?\n/).find(Boolean);
  if (!first) throw new Error(`no commit adds docs/journal/README.md in the history of ${ref}, so there is no baseline`);
  return first;
}

/** Journal text (all markdown files concatenated) as of `ref`, or from the working tree. */
export function readJournal({ root, ref, worktree }) {
  if (worktree) {
    const dir = path.join(root, 'docs', 'journal');
    let files = [];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    } catch {
      return '';
    }
    return files.map((f) => readFileSync(path.join(dir, f), 'utf8')).join('\n');
  }
  const list = git(['ls-tree', '-r', '--full-tree', '--name-only', ref, '--', ':(top)docs/journal'], root);
  if (!list.ok) throw new Error(`cannot list the journal at ${ref}: ${list.err.trim()}`);
  const parts = [];
  for (const file of list.out.split(/\r?\n/).filter((f) => JOURNAL_FILE.test(f))) {
    const show = git(['show', `${ref}:${file}`], root);
    if (!show.ok) throw new Error(`cannot read ${file} at ${ref}: ${show.err.trim()}`);
    parts.push(show.out);
  }
  return parts.join('\n');
}

/**
 * Commits from the baseline (inclusive) to ref (merges excluded, oldest first) whose header is not in the
 * journal in backticks. Returns [{sha, header}]. Throws when git fails or there is no baseline.
 */
export function findUncovered({ root = process.cwd(), ref = 'HEAD', worktree = false } = {}) {
  const baseline = detectBaseline({ root, ref });
  const hasParent = git(['rev-parse', '--verify', '--quiet', `${baseline}^`], root).ok;
  // Without a parent the baseline is a root commit, so the whole history is in scope.
  const range = hasParent ? `${baseline}^..${ref}` : ref;
  const log = git(['log', '--no-merges', '--reverse', '--format=%H%x09%s', range], root);
  if (!log.ok) throw new Error(`git log failed: ${log.err.trim()}`);
  const journal = readJournal({ root, ref, worktree });
  const missing = [];
  for (const line of log.out.split(/\r?\n/)) {
    if (!line) continue;
    const tab = line.indexOf('\t');
    const sha = line.slice(0, tab);
    const header = line.slice(tab + 1);
    if (!journal.includes(`\`${header}\``)) missing.push({ sha, header });
  }
  return missing;
}

function parseArgs(argv) {
  const opts = { ref: 'HEAD', worktree: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ref') {
      opts.ref = argv[++i];
      if (!opts.ref) throw new Error('--ref needs a value');
    } else if (a === '--worktree') opts.worktree = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

export function main(argv, start = process.cwd()) {
  const top = git(['rev-parse', '--show-toplevel'], start);
  const root = top.ok ? top.out.trim() : start;
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`check-journal-coverage: ${e.message}\n`);
    return 2;
  }
  let missing;
  try {
    missing = findUncovered({ root, ref: opts.ref, worktree: opts.worktree });
  } catch (e) {
    process.stderr.write(`check-journal-coverage: ${e.message}\n`);
    return 2;
  }
  if (missing.length === 0) {
    process.stdout.write('journal coverage: every commit has its journal line\n');
    return 0;
  }
  for (const { sha, header } of missing) {
    process.stderr.write(`journal coverage: no journal line for ${sha.slice(0, 9)} \`${header}\`\n`);
  }
  process.stderr.write(
    `journal coverage: ${missing.length} commit(s) are missing from docs/journal/*.md. Add a Turkish line containing the commit header in backticks to the "Commit günlüğü" section (for bot commits, a retroactive record).\n`,
  );
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
