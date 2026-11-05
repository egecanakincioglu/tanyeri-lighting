// Finds the bash for the shell scripts. On Windows it must be Git Bash, never the WSL launcher in System32.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const BASH_CANDIDATES = ['bin/bash.exe', 'usr/bin/bash.exe'];

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

function defaultRun(cmd: string, args: string[]): string | null {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, windowsHide: true });
  return r.error || r.status !== 0 ? null : (r.stdout ?? '').trim();
}

export interface ResolveBashOptions {
  platform?: string;
  run?: (cmd: string, args: string[]) => string | null;
  existsFn?: (p: string) => boolean;
}
export function resolveBash({
  platform = process.platform,
  run = defaultRun,
  existsFn = existsSync,
}: ResolveBashOptions = {}): string | null {
  if (platform !== 'win32') return 'bash';
  const execPath = run('git', ['--exec-path']);
  return execPath ? gitBashFromExecPath(execPath, existsFn) : null;
}
