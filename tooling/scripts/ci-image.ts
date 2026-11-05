#!/usr/bin/env node
// Prints the digest-pinned CI container image of a stage from tooling/ci-images/Dockerfile.
//   node tooling/scripts/ci-image.ts [--version] <stage>
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ci-images', 'Dockerfile');
const DIGESTED = /^\S+:\S+@sha256:[0-9a-f]{64}$/;

export function parseManifest(text: unknown): Map<string, string> {
  const stages = new Map<string, string>();
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^FROM\s+(\S+)\s+AS\s+(\S+)\s*$/i.exec(line);
    if (m) stages.set(m[2], m[1]);
  }
  return stages;
}

export function readManifest(): string {
  return readFileSync(MANIFEST, 'utf8');
}

export function resolveImage(text: unknown, stage: string): string | null {
  const ref = parseManifest(text).get(stage);
  return ref && DIGESTED.test(ref) ? ref : null;
}

export function imageVersion(text: unknown, stage: string): string | null {
  const ref = resolveImage(text, stage);
  if (!ref) return null;
  const tag = /^[^@]+:([^:@/]+)@/.exec(ref)?.[1];
  return tag ? tag.replace(/^v/, '') : null;
}

export function main(
  argv: string[],
  manifestText: string = readManifest(),
  out: (s: string) => void = console.log,
  err: (s: string) => void = console.error,
): number {
  const versionOnly = argv[0] === '--version';
  const stage = versionOnly ? argv[1] : argv[0];
  if (!stage || stage.startsWith('--')) {
    err('usage: ci-image.ts [--version] <stage>');
    return 1;
  }
  const value = versionOnly ? imageVersion(manifestText, stage) : resolveImage(manifestText, stage);
  if (!value) {
    err(`ci-image: stage "${stage}" not found or not pinned by sha256 digest in tooling/ci-images/Dockerfile`);
    return 1;
  }
  out(value);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
