// Fails when a production dependency has a license outside the allow list (read from `pnpm licenses list`).
//   node tooling/scripts/check-licenses.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pnpmStdout } from './pnpm-json.ts';

const ALLOWED = new Set([
  'MIT',
  'ISC',
  'MIT-0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'CC-BY-4.0',
  'BlueOak-1.0.0',
  'Unlicense',
]);

// libvips ships as a separate, unmodified binary, which LGPL permits.
const SHARP_PREFIX = '@img/sharp-';
const SHARP_LICENSE = 'LGPL-3.0-or-later';

export function isAllowed(expression: string, pkg: string): boolean {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let i = 0;
  const atom = (): boolean => {
    const t = tokens[i++];
    if (t === '(') {
      const v = or();
      i++;
      return v;
    }
    return t !== undefined && (ALLOWED.has(t) || (t === SHARP_LICENSE && pkg.startsWith(SHARP_PREFIX)));
  };
  const and = (): boolean => {
    let v = atom();
    while (tokens[i] === 'AND') {
      i++;
      v = atom() && v;
    }
    return v;
  };
  const or = (): boolean => {
    let v = and();
    while (tokens[i] === 'OR') {
      i++;
      v = and() || v;
    }
    return v;
  };
  const result = or();
  return result && i === tokens.length;
}

export function evaluate(licenses: Record<string, { name: string }[]>): string[] {
  const problems: string[] = [];
  for (const [expression, packages] of Object.entries(licenses)) {
    for (const p of packages) {
      if (!isAllowed(expression, p.name)) problems.push(`${p.name} is under "${expression}"`);
    }
  }
  return problems;
}

export function main(): number {
  let licenses: Record<string, { name: string }[]>;
  try {
    licenses = JSON.parse(pnpmStdout(['licenses', 'list', '--prod', '--json']) ?? '');
  } catch {
    process.stderr.write('check-licenses: `pnpm licenses list --prod --json` did not return JSON\n');
    return 2;
  }
  const problems = evaluate(licenses);
  if (problems.length === 0) {
    process.stdout.write('licenses: all production dependencies are under allowed licenses\n');
    return 0;
  }
  for (const p of problems) process.stderr.write(`licenses: ${p}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
