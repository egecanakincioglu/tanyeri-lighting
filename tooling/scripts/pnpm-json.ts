// Runs `pnpm <args>` and returns its stdout. pnpm is a .cmd shim on Windows, which Node can not spawn directly;
// the arguments are fixed strings from the callers, never user input. A non-zero exit is not an error here:
// `pnpm audit` exits 1 when it finds something, and the caller judges the JSON.
import { spawnSync } from 'node:child_process';

export function pnpmStdout(args: string[]): string | null {
  const win = process.platform === 'win32';
  const r = spawnSync(win ? 'cmd.exe' : 'pnpm', win ? ['/d', '/c', 'pnpm.cmd', ...args] : args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  return r.error ? null : r.stdout;
}
