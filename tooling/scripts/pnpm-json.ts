// Runs `pnpm <args>` and returns stdout; pnpm is a .cmd shim on Windows, which Node can not spawn directly.
// A non-zero exit is not an error: `pnpm audit` exits 1 on findings, and the caller reads the JSON.
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
