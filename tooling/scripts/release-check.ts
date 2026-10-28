// Release helpers used by .github/workflows/release.yml.
//
//   node tooling/scripts/release-check.ts verify <vX.Y.Z> [main-ref]   tag commit is on main and matches package.json
//   node tooling/scripts/release-check.ts notes <vX.Y.Z> <out-file>    write that version's CHANGELOG.md section
//
// Exit codes: 0 ok, 1 the check failed, 2 usage error. Portable: Node and git only.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = /^v(\d+\.\d+\.\d+)$/;

/** The version in a `vX.Y.Z` tag, or null when the tag has another shape. */
export function versionOfTag(tag: string): string | null {
  return TAG.exec(tag)?.[1] ?? null;
}

/** The notes of one version: the lines under `## [version] - date` up to the next `## [` heading, trimmed. */
export function changelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split(/\r?\n/);
  const heading = new RegExp(`^## \\[${version.replaceAll('.', '\\.')}\\] - \\d{4}-\\d{2}-\\d{2}\\s*$`);
  const start = lines.findIndex((l) => heading.test(l));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## ['));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return body === '' ? null : body;
}

/** True when the commit is `main` itself or one of its ancestors. */
export function isOnMain(commit: string, mainRef: string, cwd: string): boolean {
  return (
    spawnSync('git', ['merge-base', '--is-ancestor', commit, mainRef], { cwd, windowsHide: true, timeout: 30000 })
      .status === 0
  );
}

export function main(argv: string[], cwd: string = process.cwd()): number {
  const [command, tag, extra] = argv;
  const version = tag === undefined ? null : versionOfTag(tag);
  if (!version || (command !== 'verify' && command !== 'notes') || (command === 'notes' && !extra)) {
    process.stderr.write('release-check: usage: verify <vX.Y.Z> [main-ref] | notes <vX.Y.Z> <out-file>\n');
    return 2;
  }
  if (command === 'notes') {
    const notes = changelogSection(readFileSync(path.join(cwd, 'CHANGELOG.md'), 'utf8'), version);
    if (notes === null) {
      process.stderr.write(`release-check: CHANGELOG.md has no filled "## [${version}] - YYYY-MM-DD" section\n`);
      return 1;
    }
    writeFileSync(path.resolve(cwd, extra as string), `${notes}\n`);
    return 0;
  }
  const problems: string[] = [];
  const pkg = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8')) as { version?: string };
  if (pkg.version !== version) problems.push(`package.json version is ${pkg.version}, the tag says ${version}`);
  const mainRef = extra ?? 'origin/main';
  if (!isOnMain(`${tag}^{commit}`, mainRef, cwd)) problems.push(`${tag} is not on ${mainRef}`);
  for (const p of problems) process.stderr.write(`release-check: ${p}\n`);
  return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
