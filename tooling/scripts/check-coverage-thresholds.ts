// Coverage thresholds only go up: between base and head, tooling/coverage-thresholds.json may add globs and raise
// values, but must not remove a glob or metric or lower a value.
//
//   node tooling/scripts/check-coverage-thresholds.ts --base <sha> --head <sha>
//
// Exit codes: 0 ok, 1 a threshold went down or was removed, 2 usage or git error. Portable: Node only.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = 'tooling/coverage-thresholds.json';

export type Thresholds = Record<string, Record<string, number>>;

/** Problems found when going from the base thresholds to the head thresholds (empty when none). */
export function compare(base: Thresholds, head: Thresholds): string[] {
  const problems: string[] = [];
  for (const [glob, metrics] of Object.entries(base)) {
    if (!(glob in head)) {
      problems.push(`${glob} was removed`);
      continue;
    }
    for (const [metric, value] of Object.entries(metrics)) {
      const next = head[glob][metric];
      if (next === undefined) problems.push(`${glob} ${metric} was removed`);
      else if (next < value) problems.push(`${glob} ${metric} dropped from ${value} to ${next}`);
    }
  }
  return problems;
}

function show(ref: string, cwd: string): { exists: boolean; text: string } | null {
  const r = spawnSync('git', ['show', `${ref}:${FILE}`], { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (r.error) return null;
  if (r.status === 0) return { exists: true, text: r.stdout };
  // A missing path is acceptable; a bad ref is not.
  return /exists on disk, but not in|does not exist in|exists neither on disk nor in/.test(r.stderr)
    ? { exists: false, text: '' }
    : null;
}

export function main(argv: string[], cwd: string = process.cwd()): number {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const base = get('--base');
  const head = get('--head');
  if (!base || !head) {
    process.stderr.write('check-coverage-thresholds: --base <sha> and --head <sha> are required\n');
    return 2;
  }
  const before = show(base, cwd);
  const after = show(head, cwd);
  if (!before || !after) {
    process.stderr.write(`check-coverage-thresholds: could not read ${FILE} with git\n`);
    return 2;
  }
  if (!before.exists) {
    process.stdout.write('coverage thresholds: no thresholds file in base, nothing to compare\n');
    return 0;
  }
  let problems: string[];
  try {
    problems = after.exists
      ? compare(JSON.parse(before.text) as Thresholds, JSON.parse(after.text) as Thresholds)
      : [`${FILE} was deleted`];
  } catch {
    process.stderr.write(`check-coverage-thresholds: ${FILE} is not valid JSON\n`);
    return 2;
  }
  if (problems.length === 0) {
    process.stdout.write('coverage thresholds: none went down\n');
    return 0;
  }
  for (const p of problems) process.stderr.write(`coverage thresholds: ${p}\n`);
  process.stderr.write('coverage thresholds: thresholds only go up.\n');
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
