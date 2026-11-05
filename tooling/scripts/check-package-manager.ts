// Fails when package.json "packageManager" is not pinned to pnpm@<x.y.z>+sha512.<hex>.
//   node tooling/scripts/check-package-manager.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PINNED = /^pnpm@\d+\.\d+\.\d+\+sha512\.[0-9a-f]{128}$/;

export function main(cwd: string = process.cwd()): number {
  let value: unknown;
  try {
    value = (JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8')) as { packageManager?: unknown })
      .packageManager;
  } catch {
    process.stderr.write('check-package-manager: package.json is missing or not valid JSON\n');
    return 2;
  }
  if (typeof value === 'string' && PINNED.test(value)) {
    process.stdout.write('packageManager: pinned to an exact version with a hash\n');
    return 0;
  }
  process.stderr.write(
    'packageManager: must be "pnpm@<major>.<minor>.<patch>+sha512.<128 lowercase hex>" (no range, tag or pre-release)\n',
  );
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
