#!/usr/bin/env node
// Resolves a CI container image from the manifest tooling/ci-images/Dockerfile (the single source of truth).
//
//   node tooling/scripts/ci-image.ts <stage>              -> name:tag@sha256:<digest>
//   node tooling/scripts/ci-image.ts --version <stage>    -> the tag's version only (no leading "v")
//
// Exit codes: 0 ok, 1 usage error, unknown stage or a stage without a sha256 digest. Dependency-free (Node only).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ci-images', 'Dockerfile');
const DIGESTED = /^\S+:\S+@sha256:[0-9a-f]{64}$/;

/** Map of stage name -> image reference from the `FROM <ref> AS <stage>` lines. */
export function parseManifest(text: unknown): Map<string, string> {
  const stages = new Map<string, string>();
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^FROM\s+(\S+)\s+AS\s+(\S+)\s*$/i.exec(line);
    if (m) stages.set(m[2], m[1]);
  }
  return stages;
}

/** The digest-pinned reference of a stage, or null when the stage is missing or has no sha256 digest. */
export function resolveImage(text: unknown, stage: string): string | null {
  const ref = parseManifest(text).get(stage);
  return ref && DIGESTED.test(ref) ? ref : null;
}

/** The tag of a stage's image without a leading "v" (digest stripped), or null. */
export function imageVersion(text: unknown, stage: string): string | null {
  const ref = resolveImage(text, stage);
  if (!ref) return null;
  const tag = /^[^@]+:([^:@/]+)@/.exec(ref)?.[1];
  return tag ? tag.replace(/^v/, '') : null;
}

export function main(
  argv: string[],
  manifestText: string = readFileSync(MANIFEST, 'utf8'),
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
