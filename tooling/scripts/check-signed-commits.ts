#!/usr/bin/env node
// Signed-commit enforcement without the gh CLI: every non-merge commit in base..head must be reported as
// `verified` by the GitHub API (a signature checked against a key registered on the author's account).
//
//   GH_TOKEN=... REPO=owner/name node tooling/scripts/check-signed-commits.ts --base <sha> --head <sha>
//
// --base/--head fall back to BASE_SHA/HEAD_SHA. Dependency-free (Node fetch). Prints one
// `::error::commit <sha> is not verified (reason: <reason>)` line per offending commit.
// Exit codes: 0 all verified, 1 unverified commit or API failure, 2 usage or git error.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.github.com';

type RevList = { ok: true; shas: string[] } | { ok: false; err: string };

function gitRevList(base: string, head: string, cwd?: string): RevList {
  const r = spawnSync('git', ['rev-list', '--no-merges', `${base}..${head}`], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: 30000,
  });
  if (r.error || r.status !== 0) return { ok: false, err: (r.stderr ?? '') || String(r.error?.message ?? '') };
  return { ok: true, shas: r.stdout.split(/\r?\n/).filter(Boolean) };
}

/** Verification of one commit: { verified, reason }. Throws on an API failure. */
type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export async function commitVerification({
  repo,
  sha,
  token,
  fetchImpl = fetch,
}: {
  repo: string;
  sha: string;
  token: string;
  fetchImpl?: FetchLike;
}): Promise<{ verified: boolean; reason: string }> {
  const res = await fetchImpl(`${API}/repos/${repo}/commits/${sha}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'tanyeri-check-signed-commits',
    },
  });
  if (!res.ok) throw new Error(`GitHub API answered ${res.status} for commit ${sha}`);
  const body = (await res.json()) as { commit?: { verification?: { verified?: unknown; reason?: string } } } | null;
  const v = body?.commit?.verification ?? {};
  return { verified: v.verified === true, reason: v.reason ?? 'unknown' };
}

export async function main(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
  {
    exec = gitRevList,
    fetchImpl = fetch,
    cwd = process.cwd(),
    out = process.stdout,
    err = process.stderr,
  }: {
    exec?: (base: string, head: string, cwd?: string) => RevList;
    fetchImpl?: FetchLike;
    cwd?: string;
    out?: { write(s: string): unknown };
    err?: { write(s: string): unknown };
  } = {},
): Promise<number> {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const base = get('--base') ?? env.BASE_SHA;
  const head = get('--head') ?? env.HEAD_SHA;
  const repo = env.REPO;
  const token = env.GH_TOKEN;
  if (!base || !head || !repo || !token) {
    err.write('check-signed-commits: --base/--head (or BASE_SHA/HEAD_SHA), REPO and GH_TOKEN are required\n');
    return 2;
  }
  const list = exec(base, head, cwd);
  if (!list.ok) {
    err.write(`check-signed-commits: git rev-list failed: ${String(list.err).trim()}\n`);
    return 2;
  }
  let status = 0;
  for (const sha of list.shas) {
    try {
      const { verified, reason } = await commitVerification({ repo, sha, token, fetchImpl });
      if (!verified) {
        out.write(`::error::commit ${sha} is not verified (reason: ${reason})\n`);
        status = 1;
      }
    } catch (e) {
      err.write(`check-signed-commits: ${(e as Error).message}\n`);
      status = 1;
    }
  }
  if (status === 0) out.write(`signed commits: ${list.shas.length} commit(s) verified\n`);
  return status;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
