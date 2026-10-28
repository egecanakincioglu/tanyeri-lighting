import { spawnSync } from 'node:child_process';

/**
 * The entries of `relPaths` (relative to `cwd`) that git does not ignore. Outside a git work tree nothing is
 * ignored, so the list is returned unchanged.
 */
export function withoutGitIgnored(cwd: string, relPaths: string[]): string[] {
  if (relPaths.length === 0) return relPaths;
  const inside = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, encoding: 'utf8' });
  if (inside.status !== 0 || inside.stdout.trim() !== 'true') return relPaths;
  const r = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
    cwd,
    encoding: 'utf8',
    input: relPaths.join('\0') + '\0',
    maxBuffer: 64 * 1024 * 1024,
  });
  // 0 = some paths ignored, 1 = none ignored; anything else is a real failure
  if (r.status !== 0 && r.status !== 1) throw new Error(`git check-ignore failed: ${r.stderr.trim()}`);
  const ignored = new Set(r.stdout.split('\0').filter(Boolean));
  return relPaths.filter((p) => !ignored.has(p));
}
