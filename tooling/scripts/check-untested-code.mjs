#!/usr/bin/env node
// Untested code never reaches main: when a commit of type feat, fix, refactor, perf or revert adds or modifies
// production source (src/**/*.{ts,tsx,mts,cts}, test files and *.d.ts excluded), the whole range base..head must
// also add or modify at least one test file (*.test.{ts,tsx,mts,cts,mjs} or *.spec.*, anywhere).
// Commits of type style, docs, ci, build, chore and test are exempt, and so are deletion-only changes.
//
//   node tooling/scripts/check-untested-code.mjs --base <sha> --head <sha>
//
// The check is range-wide on purpose: a fix and its test may land in separate commits of one pull request.
// Exit codes: 0 ok, 1 untested source changes, 2 usage or git error. Portable: Node only.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GATED_TYPES = new Set(['feat', 'fix', 'refactor', 'perf', 'revert']);
const HEADER = /^([a-z]+)(?:\([^)]*\))?!?:/;
const SOURCE = /(?:^|\/)src\/.+\.(?:ts|tsx|mts|cts)$/;
const TEST_FILE = /\.(?:test\.(?:ts|tsx|mts|cts|mjs)|spec\.[^/]+)$/;
const TEST_DIR = /(?:^|\/)__tests__\//;
const DECLARATION = /\.d\.[cm]?ts$/;

/** True for a test file (by name or by living under __tests__/). */
export const isTestFile = (file) => TEST_FILE.test(file) || TEST_DIR.test(file);
/** True for production source that needs a test: under src/, TypeScript, not a test and not a declaration file. */
export const isGatedSource = (file) => SOURCE.test(file) && !isTestFile(file) && !DECLARATION.test(file);
/** The Conventional Commits type of a header, or null. */
export const commitType = (header) => HEADER.exec(header)?.[1] ?? null;

/**
 * Parses `git log --name-status` output (records start with \x01<sha>\t<subject>) into
 * [{ sha, header, files: [{ status, file }] }].
 */
export function parseLog(text) {
  const commits = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('\x01')) {
      const body = line.slice(1);
      const tab = body.indexOf('\t');
      commits.push({ sha: body.slice(0, tab), header: body.slice(tab + 1), files: [] });
    } else if (line && commits.length) {
      const tab = line.indexOf('\t');
      if (tab > 0) commits[commits.length - 1].files.push({ status: line[0], file: line.slice(tab + 1) });
    }
  }
  return commits;
}

/** Decision for parsed commits: { ok, offenders: [{ sha, header, files }], testFiles }. */
export function evaluate(commits) {
  const alive = (f) => f.status !== 'D';
  const testFiles = commits.flatMap((c) => c.files.filter((f) => alive(f) && isTestFile(f.file)).map((f) => f.file));
  const offenders = [];
  for (const c of commits) {
    if (!GATED_TYPES.has(commitType(c.header))) continue;
    const files = c.files.filter((f) => alive(f) && isGatedSource(f.file)).map((f) => f.file);
    if (files.length) offenders.push({ sha: c.sha, header: c.header, files });
  }
  return { ok: offenders.length === 0 || testFiles.length > 0, offenders, testFiles };
}

function git(args, cwd) {
  const r = spawnSync('git', ['-c', 'core.quotepath=off', ...args], {
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

export function main(argv, cwd = process.cwd()) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const base = get('--base');
  const head = get('--head');
  if (!base || !head) {
    process.stderr.write('check-untested-code: --base <sha> and --head <sha> are required\n');
    return 2;
  }
  // --no-renames reports a rename as delete plus add, so the new path is always seen as added.
  const log = git(['log', '--no-merges', '--no-renames', '--name-status', '--format=%x01%H%x09%s', `${base}..${head}`], cwd);
  if (!log.ok) {
    process.stderr.write(`check-untested-code: git log failed: ${log.err.trim()}\n`);
    return 2;
  }
  const result = evaluate(parseLog(log.out));
  if (result.ok) {
    process.stdout.write(
      result.offenders.length
        ? `untested code: source changes are accompanied by test changes (${result.testFiles.join(', ')})\n`
        : 'untested code: no source change that needs a test\n',
    );
    return 0;
  }
  for (const o of result.offenders) {
    process.stderr.write(`untested code: ${o.sha.slice(0, 9)} \`${o.header}\` changes source without a test:\n`);
    for (const f of o.files) process.stderr.write(`  ${f}\n`);
  }
  process.stderr.write(
    'untested code: add or change at least one *.test.* / *.spec.* file in this pull request, or, if the change ' +
      'cannot change behavior, use a commit type that is exempt (style, docs, ci, build, chore, test).\n',
  );
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
