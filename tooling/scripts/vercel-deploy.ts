// Deploys a commit from GitHub through the Vercel REST API and waits until it is ready. Vercel builds from the
// repository, so nothing is uploaded from the runner.
//
//   node tooling/scripts/vercel-deploy.ts --target preview|production --ref <branch or tag> --sha <commit>
//
// Environment: VERCEL_TOKEN, VERCEL_ORG_ID (team), VERCEL_PROJECT_ID, GITHUB_REPOSITORY (owner/repo);
// GITHUB_STEP_SUMMARY is optional. Prints the deployment address. Exit codes: 0 ready, 1 failed or timed out,
// 2 usage error. API: https://vercel.com/docs/rest-api/deployments/create-a-new-deployment and
// https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.vercel.com/v13/deployments';
const POLL_MS = 10_000;
const TIMEOUT_MS = 15 * 60_000;

export type Options = {
  target: 'preview' | 'production';
  ref: string;
  sha: string;
  token: string;
  teamId: string;
  projectId: string;
  repository: string;
};

export type Deps = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

const defaultDeps: Deps = {
  fetch: (...a) => fetch(...a),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: Date.now,
};

/** The request that creates the deployment. A preview has no `target` (the API treats an omitted target as preview). */
export function createRequest(o: Options): { url: string; init: RequestInit } {
  const [org, repo] = o.repository.split('/');
  const body = {
    name: repo,
    project: o.projectId,
    gitSource: { type: 'github', org, repo, ref: o.ref, sha: o.sha },
    ...(o.target === 'production' ? { target: 'production' } : {}),
  };
  return {
    url: `${API}?teamId=${encodeURIComponent(o.teamId)}&forceNew=1&skipAutoDetectionConfirmation=1`,
    init: {
      method: 'POST',
      headers: { Authorization: `Bearer ${o.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  };
}

type Deployment = { id?: string; url?: string; readyState?: string; errorMessage?: string };

/** What to do with a deployment state: keep waiting, succeed, or fail. */
export function decide(state: string | undefined): 'wait' | 'ready' | 'failed' {
  if (state === 'READY') return 'ready';
  if (state === 'ERROR' || state === 'CANCELED') return 'failed';
  return 'wait';
}

async function json(res: Response, what: string): Promise<Deployment> {
  if (!res.ok) throw new Error(`${what} failed with HTTP ${res.status}`);
  return (await res.json()) as Deployment;
}

/** Creates the deployment and waits for it; resolves with its address, rejects with a message without secrets. */
export async function deploy(o: Options, deps: Deps = defaultDeps): Promise<string> {
  const req = createRequest(o);
  let d = await json(await deps.fetch(req.url, req.init), 'creating the deployment');
  const id = d.id;
  if (!id) throw new Error('the API response has no deployment id');
  const deadline = deps.now() + TIMEOUT_MS;
  for (;;) {
    const verdict = decide(d.readyState);
    if (verdict === 'ready') return `https://${d.url}`;
    if (verdict === 'failed')
      throw new Error(`deployment ${id} ended as ${d.readyState}: ${d.errorMessage ?? 'no message'}`);
    if (deps.now() >= deadline) throw new Error(`deployment ${id} was not ready after ${TIMEOUT_MS / 60_000} minutes`);
    await deps.sleep(POLL_MS);
    const url = `${API}/${encodeURIComponent(id)}?teamId=${encodeURIComponent(o.teamId)}`;
    d = await json(
      await deps.fetch(url, { headers: { Authorization: `Bearer ${o.token}` } }),
      'reading the deployment',
    );
  }
}

export function parse(argv: string[], env: NodeJS.ProcessEnv): Options | string {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const target = get('--target');
  if (target !== 'preview' && target !== 'production') return '--target must be preview or production';
  const ref = get('--ref');
  const sha = get('--sha');
  if (!ref || !sha || !/^[0-9a-f]{40}$/.test(sha)) return '--ref and a full 40-character --sha are required';
  const token = env.VERCEL_TOKEN;
  const teamId = env.VERCEL_ORG_ID;
  const projectId = env.VERCEL_PROJECT_ID;
  const repository = env.GITHUB_REPOSITORY;
  if (!token || !teamId || !projectId) return 'VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID are required';
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) return 'GITHUB_REPOSITORY must be owner/repo';
  return { target, ref, sha, token, teamId, projectId, repository };
}

export async function main(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  deps: Deps = defaultDeps,
): Promise<number> {
  const o = parse(argv, env);
  if (typeof o === 'string') {
    process.stderr.write(`vercel-deploy: ${o}\n`);
    return 2;
  }
  try {
    const url = await deploy(o, deps);
    process.stdout.write(`${url}\n`);
    if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `Deployment (${o.target}): ${url}\n`);
    return 0;
  } catch (e) {
    process.stderr.write(`vercel-deploy: ${e instanceof Error ? e.message : 'unknown error'}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
