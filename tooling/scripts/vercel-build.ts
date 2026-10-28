#!/usr/bin/env node
// Vercel build command (vercel.json "buildCommand"). Deployments come only from the release workflows, so preview and
// production builds both apply the Prisma migrations before building. The Prisma client is generated in every build
// because Vercel may restore node_modules from its cache without running the postinstall script.
//
// Exit codes: 0 ok, 1 failure (missing DATABASE_URL_UNPOOLED in preview or production, or a failing step), otherwise the failing step's code.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type Step = 'generate' | 'migrate' | 'build';
export type Plan = { steps: Step[]; info?: string; error?: string };

export function plan(env: Record<string, string | undefined>): Plan {
  if (env['VERCEL_ENV'] !== 'preview' && env['VERCEL_ENV'] !== 'production') {
    return { steps: ['generate', 'build'], info: 'Migrations are not applied outside preview and production.' };
  }
  if (!env['DATABASE_URL_UNPOOLED']) {
    return {
      steps: [],
      error: 'DATABASE_URL_UNPOOLED is not set; cannot apply migrations in a preview or production build.',
    };
  }
  return { steps: ['generate', 'migrate', 'build'] };
}

// The project's own CLIs, run through the current Node so no shell or global shim is needed (Windows and Linux).
const PRISMA = path.join('node_modules', 'prisma', 'build', 'index.js');
const BIN: Record<Step, string> = {
  generate: PRISMA,
  migrate: PRISMA,
  build: path.join('node_modules', 'next', 'dist', 'bin', 'next'),
};
const ARGS: Record<Step, string[]> = { generate: ['generate'], migrate: ['migrate', 'deploy'], build: ['build'] };

function main(env: Record<string, string | undefined>): number {
  const { steps, info, error } = plan(env);
  if (error) {
    console.error(error);
    return 1;
  }
  if (info) console.log(info);
  for (const step of steps) {
    const result = spawnSync(process.execPath, [BIN[step], ...ARGS[step]], { stdio: 'inherit', env });
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.env);
}
