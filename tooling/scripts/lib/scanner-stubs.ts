// Test helpers for the pre-commit hook, which rejects a commit unless the pinned gitleaks (or a container engine) is
// usable. Tests that commit with the real hooks put these stubs first on PATH so the result never depends on the
// gitleaks, docker or podman installed on the machine.
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ci-images', 'Dockerfile');

/** The gitleaks version pinned by the CI image manifest, without a leading "v". */
export const PINNED_GITLEAKS = /gitleaks:v?([^@\s]+)@/.exec(readFileSync(MANIFEST, 'utf8'))?.[1] as string;

export const stubBin = (dir: string, name: string, body: string): void => {
  writeFileSync(path.join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path.join(dir, name), 0o755);
};

/** A fake gitleaks that reports `version` and otherwise runs `body`. */
export const fakeGitleaks = (version: string, body: string): string =>
  `if [ "\${1:-}" = version ]; then echo ${version}; exit 0; fi\n${body}`;

/** Installs a passing gitleaks at the pinned version and failing docker and podman into `dir`. */
export const installScannerStubs = (dir: string): void => {
  stubBin(dir, 'gitleaks', fakeGitleaks(PINNED_GITLEAKS, 'exit 0'));
  stubBin(dir, 'docker', 'exit 1');
  stubBin(dir, 'podman', 'exit 1');
};
