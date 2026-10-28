#!/usr/bin/env node
// Starts and stops the local development PostgreSQL in Docker. The image comes from the CI image manifest
// (tooling/ci-images/Dockerfile, stage "postgres"), so local and CI run the same version. No password: trust auth,
// and the port is bound to 127.0.0.1 only.
//
//   node tooling/scripts/db.ts up     -> creates or starts the container, waits until it accepts connections
//   node tooling/scripts/db.ts down   -> stops the container; the data volume is kept
//
// Exit codes: 0 ok, 1 failure (usage, image drift, not ready in time), 2 Docker missing or not running.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest, resolveImage } from './ci-image.ts';

const CONTAINER = 'tanyeri-postgres';
const VOLUME = 'tanyeri-postgres-data';
const URL_HINT = 'postgresql://postgres@localhost:5432/tanyeri';
const READY_TIMEOUT_MS = 30_000;

export type ContainerState = { exists: false } | { exists: true; running: boolean; image: string };
export type UpAction = 'create' | 'start' | 'none' | 'image-drift';
export type DockerResult = { status: number | null; stdout: string };

/** The `docker run` arguments. Postgres 18 images keep the data under /var/lib/postgresql, so the volume goes there. */
export function runArgs(image: string): string[] {
  return [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-p',
    '127.0.0.1:5432:5432',
    '-e',
    'POSTGRES_DB=tanyeri',
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    '-v',
    `${VOLUME}:/var/lib/postgresql`,
    image,
  ];
}

/** What `up` has to do for the current container state. */
export function upAction(state: ContainerState, image: string): UpAction {
  if (!state.exists) return 'create';
  if (state.image !== image) return 'image-drift';
  return state.running ? 'none' : 'start';
}

/** Parses the output of `docker inspect -f "{{.State.Running}} {{.Config.Image}}"`. */
export function parseInspect(output: string): ContainerState {
  const [running, image] = output.trim().split(/\s+/);
  return { exists: true, running: running === 'true', image: image ?? '' };
}

function realDocker(args: string[]): DockerResult {
  const r = spawnSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { status: r.error ? null : r.status, stdout: r.stdout ?? '' };
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function main(
  argv: string[],
  docker: (args: string[]) => DockerResult = realDocker,
  out: (s: string) => void = console.log,
  err: (s: string) => void = console.error,
  wait: (ms: number) => void = sleep,
): number {
  const command = argv[0];
  if (command !== 'up' && command !== 'down') {
    err('usage: db.ts <up|down>');
    return 1;
  }
  if (docker(['info']).status !== 0) {
    err('db: Docker is not installed or not running; start Docker Desktop and try again');
    return 2;
  }
  const inspected = docker(['inspect', '-f', '{{.State.Running}} {{.Config.Image}}', CONTAINER]);
  const state: ContainerState = inspected.status === 0 ? parseInspect(inspected.stdout) : { exists: false };

  if (command === 'down') {
    if (!state.exists) {
      out(`db: ${CONTAINER} does not exist, nothing to stop`);
      return 0;
    }
    return docker(['stop', CONTAINER]).status === 0 ? 0 : 1;
  }

  const image = resolveImage(readManifest(), 'postgres');
  if (!image) {
    err('db: stage "postgres" not found or not pinned by digest in tooling/ci-images/Dockerfile');
    return 1;
  }
  const action = upAction(state, image);
  if (action === 'image-drift') {
    err(`db: ${CONTAINER} runs another image; run "pnpm db:down", "docker rm ${CONTAINER}", then "pnpm db:up"`);
    return 1;
  }
  if (action !== 'none' && docker(action === 'create' ? runArgs(image) : ['start', CONTAINER]).status !== 0) {
    err(`db: could not ${action} ${CONTAINER}`);
    return 1;
  }
  for (let waited = 0; waited <= READY_TIMEOUT_MS; waited += 500) {
    if (docker(['exec', CONTAINER, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'tanyeri']).status === 0) {
      out(URL_HINT);
      return 0;
    }
    wait(500);
  }
  err(`db: ${CONTAINER} did not become ready within ${READY_TIMEOUT_MS / 1000} s`);
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
