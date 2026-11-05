// Stubs put first on PATH so hook tests do not depend on the gitleaks, docker or podman of the machine.
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MANIFEST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'ci-images', 'Dockerfile');

export const PINNED_GITLEAKS = /gitleaks:v?([^@\s]+)@/.exec(readFileSync(MANIFEST, 'utf8'))?.[1] as string;

export const stubBin = (dir: string, name: string, body: string): void => {
  writeFileSync(path.join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
  chmodSync(path.join(dir, name), 0o755);
};

export const fakeGitleaks = (version: string, body: string): string =>
  `if [ "\${1:-}" = version ]; then echo ${version}; exit 0; fi\n${body}`;

export const installScannerStubs = (dir: string): void => {
  stubBin(dir, 'gitleaks', fakeGitleaks(PINNED_GITLEAKS, 'exit 0'));
  stubBin(dir, 'docker', 'exit 1');
  stubBin(dir, 'podman', 'exit 1');
};
