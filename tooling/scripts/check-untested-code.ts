#!/usr/bin/env node
// Fails when a range of non-style commits changes src/ code but no test file; the whole range counts.
//   node tooling/scripts/check-untested-code.ts --base <sha> --head <sha>
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXEMPT_TYPE = 'style';
const HEADER = /^([a-z]+)(?:\([^)]*\))?!?:/;
const SOURCE = /(?:^|\/)src\/.+\.(?:ts|tsx|mts|cts)$/;
const TEST_FILE = /\.(?:test\.(?:ts|tsx|mts|cts|mjs)|spec\.[^/]+)$/;
const TEST_DIR = /(?:^|\/)__tests__\//;
const DECLARATION = /\.d\.[cm]?ts$/;

export const isTestFile = (file: string): boolean => TEST_FILE.test(file) || TEST_DIR.test(file);
export const isGatedSource = (file: string): boolean =>
  SOURCE.test(file) && !isTestFile(file) && !DECLARATION.test(file);
export const commitType = (header: string): string | null => HEADER.exec(header)?.[1] ?? null;

export type Commit = { sha: string; header: string; files: { status: string; file: string }[] };
export function parseLog(text: string): Commit[] {
  const commits: Commit[] = [];
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

export function evaluate(commits: Commit[]): {
  ok: boolean;
  offenders: { sha: string; header: string; files: string[] }[];
  testFiles: string[];
} {
  const alive = (f: { status: string }): boolean => f.status !== 'D';
  const testFiles = commits.flatMap((c) => c.files.filter((f) => alive(f) && isTestFile(f.file)).map((f) => f.file));
  const offenders: { sha: string; header: string; files: string[] }[] = [];
  for (const c of commits) {
    if (commitType(c.header) === EXEMPT_TYPE) continue;
    const files = c.files.filter((f) => alive(f) && isGatedSource(f.file)).map((f) => f.file);
    if (files.length) offenders.push({ sha: c.sha, header: c.header, files });
  }
  return { ok: offenders.length === 0 || testFiles.length > 0, offenders, testFiles };
}

function git(args: string[], cwd?: string): { ok: boolean; out: string; err: string } {
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

export function main(argv: string[], cwd: string = process.cwd()): number {
  const get = (flag: string): string | undefined => {
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
  const log = git(
    ['log', '--no-merges', '--no-renames', '--name-status', '--format=%x01%H%x09%s', `${base}..${head}`],
    cwd,
  );
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
      'cannot change behavior, make it a `style` commit if it only formats code.\n',
  );
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
