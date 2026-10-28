// Prepares a release: computes the next SemVer version from the Conventional Commits since the last v* tag, writes it
// to package.json and puts a new section at the top of CHANGELOG.md. It does not tag, push or publish.
//
//   node tooling/scripts/release-prepare.ts [--version X.Y.Z] [--dry-run]
//
// Bump rules: breaking change -> MAJOR (MINOR while the version is below 1.0.0), feat -> MINOR, fix -> PATCH;
// when none of them is present the suggestion is PATCH. Exit codes: 0 ok, 1 invalid version or nothing to release,
// 2 usage or environment error. Runs in the working directory (a git repository with a package.json).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Commit {
  sha: string;
  type: string;
  breaking: boolean;
  summary: string;
  header: string;
}

const HEADER = /^(\w+)(?:\([^)]*\))?(!)?: (.+)$/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE:/m;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const CHANGELOG_INTRO =
  '# Changelog\n\nAll notable changes to this project are documented here. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n';

/** Parses one commit; a header that is not a Conventional Commit becomes type "other". */
export function parseCommit(sha: string, subject: string, body: string): Commit {
  const m = HEADER.exec(subject);
  if (!m) return { sha, type: 'other', breaking: BREAKING_FOOTER.test(body), summary: subject, header: subject };
  return {
    sha,
    type: m[1].toLowerCase(),
    breaking: m[2] === '!' || BREAKING_FOOTER.test(body),
    summary: m[3],
    header: subject,
  };
}

function parseVersion(text: string): [number, number, number] | null {
  const m = SEMVER.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Negative when a < b, zero when equal, positive when a > b. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) throw new Error(`not a X.Y.Z version: ${x ? b : a}`);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** The next version after `current` for the given commits. */
export function nextVersion(current: string, commits: Commit[]): string {
  const v = parseVersion(current);
  if (!v) throw new Error(`not a X.Y.Z version: ${current}`);
  const [major, minor, patch] = v;
  if (commits.some((c) => c.breaking)) return major < 1 ? `${major}.${minor + 1}.0` : `${major + 1}.0.0`;
  if (commits.some((c) => c.type === 'feat')) return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** The changelog section for a release (ends with a newline). */
export function renderSection(version: string, date: string, commits: Commit[]): string {
  const line = (c: Commit, text: string): string => `- ${text} (${c.sha})`;
  const groups: [string, string[]][] = [
    ['Breaking changes', commits.filter((c) => c.breaking).map((c) => line(c, c.header))],
    ['Features', commits.filter((c) => c.type === 'feat').map((c) => line(c, c.summary))],
    ['Fixes', commits.filter((c) => c.type === 'fix').map((c) => line(c, c.summary))],
    ['Other', commits.filter((c) => c.type !== 'feat' && c.type !== 'fix').map((c) => line(c, c.header))],
  ];
  let out = `## [${version}] - ${date}\n`;
  for (const [title, lines] of groups) if (lines.length) out += `\n### ${title}\n${lines.join('\n')}\n`;
  return out;
}

/** Puts `section` above the newest existing section (or at the end when there is none). */
export function insertSection(changelog: string, section: string): string {
  const at = changelog.search(/^## \[/m);
  if (at === -1) return `${changelog.trimEnd()}\n\n${section}`;
  return `${changelog.slice(0, at)}${section}\n${changelog.slice(at)}`;
}

/** package.json text with only the "version" value replaced. */
export function setPackageVersion(text: string, version: string): string {
  const re = /("version"\s*:\s*")[^"]*(")/;
  if (!re.test(text)) throw new Error('package.json has no "version" field');
  return text.replace(re, `$1${version}$2`);
}

const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** The file's text, or `fallback` when it does not exist (any other error is thrown). */
function readOrDefault(file: string, fallback: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
}

function lastTag(cwd: string): string | null {
  try {
    return git(cwd, 'describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*').trim() || null;
  } catch {
    return null;
  }
}

/** Non-merge commits after `tag` (or all of them) up to HEAD, newest first. */
function readCommits(cwd: string, tag: string | null): Commit[] {
  const out = git(cwd, 'log', '--no-merges', '--format=%h%x1f%s%x1f%b%x1e', tag ? `${tag}..HEAD` : 'HEAD');
  return out
    .split('\x1e')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r.trim())
    .map((r) => {
      const [sha, subject, body] = r.split('\x1f');
      return parseCommit(sha, subject, body ?? '');
    });
}

export function main(
  argv: string[],
  cwd: string = process.cwd(),
  today: string = new Date().toISOString().slice(0, 10),
): number {
  const dryRun = argv.includes('--dry-run');
  const vi = argv.indexOf('--version');
  if (vi !== -1 && !argv[vi + 1]) {
    process.stderr.write('release-prepare: --version needs X.Y.Z\n');
    return 2;
  }
  const requested = vi !== -1 ? argv[vi + 1] : null;
  if (requested !== null && !SEMVER.test(requested)) {
    process.stderr.write(`release-prepare: "${requested}" is not a plain X.Y.Z version\n`);
    return 2;
  }
  try {
    const pkgPath = path.join(cwd, 'package.json');
    const pkgText = readFileSync(pkgPath, 'utf8');
    const tag = lastTag(cwd);
    const base = tag ? tag.slice(1) : (JSON.parse(pkgText) as { version: string }).version;
    const commits = readCommits(cwd, tag);
    if (!commits.length) {
      process.stderr.write(`release-prepare: no commits since ${tag ?? 'the start'}; nothing to release\n`);
      return 1;
    }
    if (requested !== null && compareVersions(requested, base) <= 0) {
      process.stderr.write(`release-prepare: ${requested} must be greater than the current version ${base}\n`);
      return 1;
    }
    const version = requested ?? nextVersion(base, commits);
    const section = renderSection(version, today, commits);
    const changelogPath = path.join(cwd, 'CHANGELOG.md');
    const changelog = readOrDefault(changelogPath, CHANGELOG_INTRO);
    if (!dryRun) {
      writeFileSync(pkgPath, setPackageVersion(pkgText, version));
      writeFileSync(changelogPath, insertSection(changelog, section));
    }
    process.stdout.write(
      `${dryRun ? 'Dry run: nothing written. ' : ''}Release ${version} (from ${base}, ${commits.length} commit(s) since ${tag ?? 'the start'})\n\n${section}`,
    );
    return 0;
  } catch (e) {
    process.stderr.write(`release-prepare: ${(e as Error).message}\n`);
    return 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
