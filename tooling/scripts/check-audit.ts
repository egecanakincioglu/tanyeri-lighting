// Dependency audit: `pnpm audit` must report no high or critical advisory, unless tooling/audit-exceptions.json lists
// it. Each exception is { id: "<GHSA id>", reason, expires: "YYYY-MM-DD" } and an expired one fails on its own, so an
// exception can not outlive its date.
//
//   node tooling/scripts/check-audit.ts
//
// Exit codes: 0 ok, 1 findings or expired exceptions, 2 audit output or exceptions file unreadable.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pnpmStdout } from './pnpm-json.ts';

export type AuditException = { id: string; reason: string; expires: string };

type Advisory = { github_advisory_id?: string; severity?: string; module_name?: string };

export function evaluate(audit: unknown, exceptions: AuditException[], today: string): string[] {
  const problems: string[] = [];
  const active = new Set<string>();
  for (const e of exceptions) {
    if (e.expires < today) problems.push(`exception ${e.id} expired on ${e.expires}`);
    else active.add(e.id);
  }
  const advisories = (audit as { advisories?: Record<string, Advisory> }).advisories ?? {};
  for (const [key, a] of Object.entries(advisories)) {
    const id = a.github_advisory_id ?? key;
    if ((a.severity === 'high' || a.severity === 'critical') && !active.has(id)) {
      problems.push(`${a.severity} advisory ${id} in ${a.module_name ?? 'unknown package'}`);
    }
  }
  return problems;
}

export function main(cwd: string = process.cwd(), today: string = new Date().toISOString().slice(0, 10)): number {
  let exceptions: AuditException[];
  try {
    exceptions = JSON.parse(readFileSync(path.join(cwd, 'tooling/audit-exceptions.json'), 'utf8')) as AuditException[];
  } catch {
    process.stderr.write('check-audit: tooling/audit-exceptions.json is missing or not valid JSON\n');
    return 2;
  }
  let audit: unknown;
  try {
    audit = JSON.parse(pnpmStdout(['audit', '--json']) ?? '');
  } catch {
    process.stderr.write('check-audit: `pnpm audit --json` did not return JSON (offline or registry error?)\n');
    return 2;
  }
  const problems = evaluate(audit, exceptions, today);
  if (problems.length === 0) {
    process.stdout.write('audit: no high or critical advisories\n');
    return 0;
  }
  for (const p of problems) process.stderr.write(`audit: ${p}\n`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
