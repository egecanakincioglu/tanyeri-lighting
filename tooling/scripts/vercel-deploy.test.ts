// Tests for vercel-deploy.ts with a faked fetch (no real API call is made).
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { createRequest, decide, deploy, main, parse, type Deps, type Options } from './vercel-deploy.ts';

const SHA = 'a'.repeat(40);
const OPTS: Options = {
  target: 'preview',
  ref: 'release/1.0.0',
  sha: SHA,
  token: 'secret-token',
  teamId: 'team_1',
  projectId: 'prj_1',
  repository: 'owner/repo',
};
const ENV = {
  VERCEL_TOKEN: 'secret-token',
  VERCEL_ORG_ID: 'team_1',
  VERCEL_PROJECT_ID: 'prj_1',
  GITHUB_REPOSITORY: 'owner/repo',
};
const ARGS = ['--target', 'preview', '--ref', 'main', '--sha', SHA];

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Deps that serve the given responses in order; time advances by the slept amount. */
function fake(responses: Response[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let clock = 0;
  const deps: Deps = {
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      const next = responses.shift();
      assert.ok(next, 'unexpected extra request');
      return next;
    },
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
  };
  return { deps, calls };
}

async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const write = process.stderr.write;
  process.stderr.write = () => true;
  try {
    return await fn();
  } finally {
    process.stderr.write = write;
  }
}

describe('createRequest', () => {
  test('a preview has no target and uses the github source', () => {
    const { url, init } = createRequest(OPTS);
    assert.match(url, /^https:\/\/api\.vercel\.com\/v13\/deployments\?teamId=team_1&/);
    assert.equal(init.method, 'POST');
    assert.deepEqual(init.headers, { Authorization: 'Bearer secret-token', 'Content-Type': 'application/json' });
    assert.deepEqual(JSON.parse(init.body as string), {
      name: 'repo',
      project: 'prj_1',
      gitSource: { type: 'github', org: 'owner', repo: 'repo', ref: 'release/1.0.0', sha: SHA },
    });
  });
  test('production sets the production target', () => {
    const body = JSON.parse(createRequest({ ...OPTS, target: 'production' }).init.body as string);
    assert.equal(body.target, 'production');
  });
});

describe('decide', () => {
  test('READY succeeds', () => assert.equal(decide('READY'), 'ready'));
  for (const s of ['ERROR', 'CANCELED']) test(`${s} fails`, () => assert.equal(decide(s), 'failed'));
  for (const s of ['QUEUED', 'INITIALIZING', 'BUILDING', 'BLOCKED', undefined])
    test(`${s} waits`, () => assert.equal(decide(s), 'wait'));
});

describe('deploy', () => {
  test('returns the address once the deployment is ready, polling by id', async () => {
    const { deps, calls } = fake([
      reply({ id: 'dpl_1', readyState: 'QUEUED' }),
      reply({ id: 'dpl_1', readyState: 'BUILDING' }),
      reply({ id: 'dpl_1', url: 'repo-abc.vercel.app', readyState: 'READY' }),
    ]);
    assert.equal(await deploy(OPTS, deps), 'https://repo-abc.vercel.app');
    assert.equal(calls.length, 3);
    assert.equal(calls[1].url, 'https://api.vercel.com/v13/deployments/dpl_1?teamId=team_1');
  });
  test('an ERROR state rejects with the API message', async () => {
    const { deps } = fake([reply({ id: 'dpl_1', readyState: 'ERROR', errorMessage: 'build failed' })]);
    await assert.rejects(deploy(OPTS, deps), /ended as ERROR: build failed/);
  });
  test('a CANCELED state rejects', async () => {
    const { deps } = fake([
      reply({ id: 'dpl_1', readyState: 'QUEUED' }),
      reply({ id: 'dpl_1', readyState: 'CANCELED' }),
    ]);
    await assert.rejects(deploy(OPTS, deps), /ended as CANCELED/);
  });
  test('a deployment that never gets ready times out', async () => {
    const { deps } = fake(Array.from({ length: 200 }, () => reply({ id: 'dpl_1', readyState: 'BUILDING' })));
    await assert.rejects(deploy(OPTS, deps), /not ready after 15 minutes/);
  });
  test('an HTTP error while creating rejects without the token', async () => {
    const { deps } = fake([reply({ error: 'no' }, 403)]);
    await assert.rejects(
      deploy(OPTS, deps),
      (e: Error) => /HTTP 403/.test(e.message) && !e.message.includes('secret-token'),
    );
  });
  test('an HTTP error while polling rejects', async () => {
    const { deps } = fake([reply({ id: 'dpl_1', readyState: 'QUEUED' }), reply({}, 500)]);
    await assert.rejects(deploy(OPTS, deps), /reading the deployment failed with HTTP 500/);
  });
  test('a response without an id rejects', async () => {
    const { deps } = fake([reply({ readyState: 'QUEUED' })]);
    await assert.rejects(deploy(OPTS, deps), /no deployment id/);
  });
});

describe('parse', () => {
  test('valid arguments and environment', () => assert.deepEqual(parse(ARGS, ENV), { ...OPTS, ref: 'main' }));
  test('bad target, missing ref, short sha', () => {
    assert.match(parse(['--target', 'staging', '--ref', 'x', '--sha', SHA], ENV) as string, /--target/);
    assert.match(parse(['--target', 'preview', '--sha', SHA], ENV) as string, /--ref/);
    assert.match(parse(['--target', 'preview', '--ref', 'x', '--sha', 'abc'], ENV) as string, /--sha/);
  });
  test('missing credentials or bad repository', () => {
    assert.match(parse(ARGS, { ...ENV, VERCEL_TOKEN: '' }) as string, /VERCEL_TOKEN/);
    assert.match(parse(ARGS, { ...ENV, GITHUB_REPOSITORY: 'nope' }) as string, /GITHUB_REPOSITORY/);
  });
});

describe('main', () => {
  test('prints the address, writes the step summary and exits 0', async () => {
    const dir = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'vercel-deploy-'));
    try {
      const summary = path.join(dir, 'summary.md');
      const { deps } = fake([reply({ id: 'dpl_1', url: 'repo-abc.vercel.app', readyState: 'READY' })]);
      const chunks: string[] = [];
      const write = process.stdout.write;
      process.stdout.write = ((c: string) => (chunks.push(c), true)) as typeof process.stdout.write;
      let code: number;
      try {
        code = await main(ARGS, { ...ENV, GITHUB_STEP_SUMMARY: summary }, deps);
      } finally {
        process.stdout.write = write;
      }
      assert.equal(code, 0);
      assert.deepEqual(chunks, ['https://repo-abc.vercel.app\n']);
      assert.match(readFileSync(summary, 'utf8'), /https:\/\/repo-abc\.vercel\.app/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test('a failed deployment exits 1', async () => {
    const { deps } = fake([reply({ id: 'dpl_1', readyState: 'ERROR' })]);
    assert.equal(await quiet(() => main(ARGS, ENV, deps)), 1);
  });
  test('a usage error exits 2 without calling the API', async () => {
    const { deps, calls } = fake([]);
    assert.equal(await quiet(() => main([], ENV, deps)), 2);
    assert.equal(calls.length, 0);
  });
});
