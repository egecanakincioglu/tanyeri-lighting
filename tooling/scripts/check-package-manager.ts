// The package manager is pinned exactly: package.json "packageManager" must be pnpm@<x.y.z>+sha512.<hex>, so Corepack
// installs the same bytes everywhere and a range, tag or missing hash can not slip in.
//
//   node tooling/scripts/check-package-manager.ts
//
// Exit codes: 0 ok, 1 not pinned, 2 package.json unreadable. Reads package.json in the working directory.
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
