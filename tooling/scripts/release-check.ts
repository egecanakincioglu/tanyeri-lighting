// Release helpers used by .github/workflows/release.yml.
//   node tooling/scripts/release-check.ts verify|title|notes <vX.Y.Z> [args]
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = /^v(\d+\.\d+\.\d+)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function versionOfTag(tag: string): string | null {
  return TAG.exec(tag)?.[1] ?? null;
}

export const PLACEHOLDER = '<!-- fill in -->';

export function hasPlaceholder(text: string): boolean {
  return text.includes('<!-- fill in');
}

export function notesPath(version: string): string {
  return `releases/v${version}.md`;
}

export function notesHeading(text: string, version: string): string | null {
  const first = (text.split(/\r?\n/, 1)[0] ?? '').trimEnd();
  const prefix = `# v${version} — `;
  if (!first.startsWith(prefix) || first.slice(prefix.length).trim() === '') return null;
  return first.slice(2);
}

export function releaseBody(notes: string, commitList: string): string {
  const body = notes.split(/\r?\n/).slice(1).join('\n').trim();
  return `${body}\n\n<details>\n<summary>Commit list</summary>\n\n${commitList}\n</details>\n`;
}

function readNotes(cwd: string, version: string): string | null {
  try {
    return readFileSync(path.join(cwd, notesPath(version)), 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export function changelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split(/\r?\n/);
  const prefix = `## [${version}] - `;
  const start = lines.findIndex((l) => l.startsWith(prefix) && DATE.test(l.slice(prefix.length).trim()));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## ['));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return body === '' ? null : body;
}

export function isOnMain(commit: string, mainRef: string, cwd: string): boolean {
  return (
    spawnSync('git', ['merge-base', '--is-ancestor', commit, mainRef], { cwd, windowsHide: true, timeout: 30000 })
      .status === 0
  );
}

export function main(argv: string[], cwd: string = process.cwd()): number {
  const [command, tag, extra] = argv;
  const version = tag === undefined ? null : versionOfTag(tag);
  if (
    !version ||
    (command !== 'verify' && command !== 'notes' && command !== 'title') ||
    (command === 'notes' && !extra)
  ) {
    process.stderr.write(
      'release-check: usage: verify <vX.Y.Z> [main-ref] | title <vX.Y.Z> | notes <vX.Y.Z> <out-file>\n',
    );
    return 2;
  }
  if (command === 'title' || command === 'notes') {
    const file = notesPath(version);
    const notes = readNotes(cwd, version);
    if (notes === null) {
      process.stderr.write(`release-check: ${file} does not exist\n`);
      return 1;
    }
    if (hasPlaceholder(notes)) {
      process.stderr.write(`release-check: ${file} still contains a "<!-- fill in" comment\n`);
      return 1;
    }
    const heading = notesHeading(notes, version);
    if (heading === null) {
      process.stderr.write(`release-check: the first line of ${file} must be "# v${version} — <title>"\n`);
      return 1;
    }
    if (command === 'title') {
      process.stdout.write(`${heading}\n`);
      return 0;
    }
    const section = changelogSection(readFileSync(path.join(cwd, 'CHANGELOG.md'), 'utf8'), version);
    if (section === null) {
      process.stderr.write(`release-check: CHANGELOG.md has no filled "## [${version}] - YYYY-MM-DD" section\n`);
      return 1;
    }
    writeFileSync(path.resolve(cwd, extra as string), releaseBody(notes, section));
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
