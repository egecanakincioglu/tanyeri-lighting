// Site audit thresholds only tighten: between base and head, tooling/site-audit/thresholds.json may raise category
// scores and the expected score, lower budgets and add keys, but no score may drop, be removed or sit below 90, and no
// budget may grow or be removed.
//
//   node tooling/scripts/check-site-audit-thresholds.ts --base <sha> --head <sha>
//
// Exit codes: 0 ok, 1 a threshold was loosened, 2 usage or git error. Portable: Node only.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = 'tooling/site-audit/thresholds.json';
const FLOOR = 90;

export interface Thresholds {
  categories?: Record<string, number>;
  expected?: number;
  budgets?: Record<string, number>;
}

/** Every score (categories plus expected) by display name. */
function scores(t: Thresholds): Map<string, number> {
  const all = new Map<string, number>();
  for (const [k, v] of Object.entries(t.categories ?? {})) all.set(`category ${k}`, v);
  if (t.expected !== undefined) all.set('expected', t.expected);
  return all;
}

/** Problems found when going from the base thresholds to the head thresholds (empty when none). */
export function compare(base: Thresholds, head: Thresholds): string[] {
  const problems: string[] = [];
  const headScores = scores(head);
  for (const [name, before] of scores(base)) {
    const after = headScores.get(name);
    if (after === undefined) problems.push(`${name} was removed`);
    else if (after < before) problems.push(`${name} dropped from ${before} to ${after}`);
  }
  for (const [name, value] of headScores) {
    if (value < FLOOR) problems.push(`${name} is ${value}, below the ${FLOOR} floor`);
  }
  for (const [key, before] of Object.entries(base.budgets ?? {})) {
    const after = head.budgets?.[key];
    if (after === undefined) problems.push(`budget ${key} was removed`);
    else if (after > before) problems.push(`budget ${key} grew from ${before} to ${after}`);
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
    process.stderr.write('check-site-audit-thresholds: --base <sha> and --head <sha> are required\n');
    return 2;
  }
  const before = show(base, cwd);
  const after = show(head, cwd);
  if (!before || !after) {
    process.stderr.write(`check-site-audit-thresholds: could not read ${FILE} with git\n`);
    return 2;
  }
  if (!before.exists) {
    process.stdout.write('site audit thresholds: no thresholds file in base, nothing to compare\n');
    return 0;
  }
  let problems: string[];
  try {
    problems = after.exists
      ? compare(JSON.parse(before.text) as Thresholds, JSON.parse(after.text) as Thresholds)
      : [`${FILE} was deleted`];
  } catch {
    process.stderr.write(`check-site-audit-thresholds: ${FILE} is not valid JSON\n`);
    return 2;
  }
  if (problems.length === 0) {
    process.stdout.write('site audit thresholds: none loosened\n');
    return 0;
  }
  for (const p of problems) process.stderr.write(`site audit thresholds: ${p}\n`);
  process.stderr.write('site audit thresholds: scores only go up (never below 90) and budgets only shrink.\n');
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
