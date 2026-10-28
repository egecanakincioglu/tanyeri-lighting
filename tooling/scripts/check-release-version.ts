// A pull request that changes the version in package.json must also change CHANGELOG.md, and the version may only
// go up (SemVer).
//
//   node tooling/scripts/check-release-version.ts --base <sha> --head <sha>
//
// Exit codes: 0 ok, 1 a rule is broken, 2 usage or git error. Portable: Node and git only.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Negative, zero or positive like a sort comparator; null when either side is not a plain X.Y.Z version. */
export function compareVersions(a: string, b: string): number | null {
  const x = SEMVER.exec(a);
  const y = SEMVER.exec(b);
  if (!x || !y) return null;
  for (let i = 1; i <= 3; i++) {
    const d = Number(x[i]) - Number(y[i]);
    if (d !== 0) return d;
  }
  return 0;
}

type Snapshot = { version: string; changelog: string | null };

/** Problems found when going from the base version/changelog to the head ones (empty when none). */
export function check(base: Snapshot, head: Snapshot): string[] {
  if (base.version === head.version) return [];
  const problems: string[] = [];
  const order = compareVersions(head.version, base.version);
  if (order === null) problems.push(`version must be X.Y.Z (base ${base.version}, head ${head.version})`);
  else if (order <= 0) problems.push(`version must go up, but it went from ${base.version} to ${head.version}`);
  if (base.changelog === head.changelog) problems.push('the version changed but CHANGELOG.md did not');
  return problems;
}

/** File content at a ref; null when the file is absent there; undefined when git itself failed. */
function show(ref: string, file: string, cwd: string): string | null | undefined {
  const r = spawnSync('git', ['show', `${ref}:${file}`], { cwd, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  if (r.error) return undefined;
  if (r.status === 0) return r.stdout;
  return /exists on disk, but not in|does not exist in|exists neither on disk nor in/.test(r.stderr) ? null : undefined;
}

export function main(argv: string[], cwd: string = process.cwd()): number {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const base = get('--base');
  const head = get('--head');
  if (!base || !head) {
    process.stderr.write('check-release-version: --base <sha> and --head <sha> are required\n');
    return 2;
  }
  const read = (ref: string): Snapshot | null => {
    const pkg = show(ref, 'package.json', cwd);
    const changelog = show(ref, 'CHANGELOG.md', cwd);
    if (typeof pkg !== 'string' || changelog === undefined) return null;
    const version = (JSON.parse(pkg) as { version?: unknown }).version;
    return typeof version === 'string' ? { version, changelog } : null;
  };
  let before: Snapshot | null;
  let after: Snapshot | null;
  try {
    before = read(base);
    after = read(head);
  } catch {
    before = after = null;
  }
  if (!before || !after) {
    process.stderr.write('check-release-version: could not read package.json (version) and CHANGELOG.md with git\n');
    return 2;
  }
  const problems = check(before, after);
  if (problems.length === 0) {
    process.stdout.write('release version: unchanged, or bumped upward with a changelog entry\n');
    return 0;
  }
  for (const p of problems) process.stderr.write(`release version: ${p}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
