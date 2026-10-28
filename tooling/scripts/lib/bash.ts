// Finds the bash to run the project's shell scripts with. Node only, same behavior on Linux and Windows.
// On Windows, `bash` on PATH is often the WSL launcher (C:\Windows\System32\bash.exe), a different Linux
// environment; the project scripts need Git Bash, which is located from git's own install directory.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASH_CANDIDATES = ['bin/bash.exe', 'usr/bin/bash.exe'];

/**
 * Pure: Git Bash path derived from `git --exec-path` output (e.g. "C:/Program Files/Git/mingw64/libexec/git-core").
 * Walks up from that directory and returns the first `<dir>/bin/bash.exe` or `<dir>/usr/bin/bash.exe` that
 * existsFn accepts, or null. Forward slashes are used in the result. System32 (the WSL launcher) is never used.
 */
export function gitBashFromExecPath(execPath: unknown, existsFn: (p: string) => boolean = existsSync): string | null {
  const norm = String(execPath ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  if (!norm) return null;
  const parts = norm.split('/');
  while (parts.length > 1) {
    parts.pop();
    if (/^system32$/i.test(parts[parts.length - 1])) continue;
    const dir = parts.join('/');
    for (const rel of BASH_CANDIDATES) {
      const candidate = `${dir}/${rel}`;
      if (existsFn(candidate)) return candidate;
    }
  }
  return null;
}

/** Runs a command without a shell and returns its trimmed stdout, or null on failure. */
function defaultRun(cmd: string, args: string[]): string | null {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, windowsHide: true });
  return r.error || r.status !== 0 ? null : (r.stdout ?? '').trim();
}

/**
 * The bash executable to spawn: 'bash' outside Windows; on Windows the Git Bash found via git, or null when
 * there is none. Never returns the WSL launcher in System32.
 */
export interface ResolveBashOptions {
  platform?: string;
  run?: (cmd: string, args: string[]) => string | null;
  existsFn?: (p: string) => boolean;
}
export function resolveBash({ platform = process.platform, run = defaultRun, existsFn = existsSync }: ResolveBashOptions = {}): string | null {
  if (platform !== 'win32') return 'bash';
  const execPath = run('git', ['--exec-path']);
  return execPath ? gitBashFromExecPath(execPath, existsFn) : null;
}
