// Tests for check-signed-commits.ts with an injected git listing and an injected fetch.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { main } from './check-signed-commits.ts';

const ENV: NodeJS.ProcessEnv = { REPO: 'o/r', GH_TOKEN: 't', BASE_SHA: 'b', HEAD_SHA: 'h' };
const sink = () => {
  let text = '';
  return {
    write: (s: string) => (text += s),
    get text() {
      return text;
    },
  };
};
const answer = (map: Record<string, unknown>) => async (url: string) => {
  const sha = url.split('/').pop() as string;
  const v = map[sha];
  if (v === 'fail') return { ok: false, status: 500, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => ({ commit: { verification: v } }) };
};
const run = async (shas: string[], map: Record<string, unknown>, env: NodeJS.ProcessEnv = ENV, argv: string[] = []) => {
  const out = sink();
  const err = sink();
  const code = await main(argv, env, { exec: () => ({ ok: true, shas }), fetchImpl: answer(map), out, err });
  return { code, out: out.text, err: err.text };
};

describe('check-signed-commits', () => {
  test('all verified -> 0', async () => {
    const r = await run(['a', 'b'], { a: { verified: true, reason: 'valid' }, b: { verified: true, reason: 'valid' } });
    assert.equal(r.code, 0);
  });
  test('unverified commit -> error line with the reason, exit 1', async () => {
    const r = await run(['a', 'b'], {
      a: { verified: true, reason: 'valid' },
      b: { verified: false, reason: 'unsigned' },
    });
    assert.equal(r.code, 1);
    assert.match(r.out, /::error::commit b is not verified \(reason: unsigned\)/);
    assert.doesNotMatch(r.out, /commit a is not/);
  });
  test('API failure -> nonzero', async () => {
    const r = await run(['a'], { a: 'fail' });
    assert.notEqual(r.code, 0);
  });
  test('arguments override the environment', async () => {
    let seen;
    const out = sink();
    await main(['--base', 'x', '--head', 'y'], ENV, {
      exec: (b, h) => ((seen = [b, h]), { ok: true, shas: [] }),
      fetchImpl: answer({}),
      out,
      err: sink(),
    });
    assert.deepEqual(seen, ['x', 'y']);
  });
  test('missing token -> usage error 2', async () => {
    const r = await run([], {}, { REPO: 'o/r', BASE_SHA: 'b', HEAD_SHA: 'h' });
    assert.equal(r.code, 2);
  });
  test('git failure -> 2', async () => {
    const err = sink();
    const code = await main([], ENV, {
      exec: () => ({ ok: false, err: 'bad' }),
      fetchImpl: answer({}),
      out: sink(),
      err,
    });
    assert.equal(code, 2);
  });
});

describe('real git listing', () => {
  test('merge commits are excluded from the checked commits', async () => {
    const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'signed-test-'));
    try {
      const git = (...a: string[]) => {
        const r = spawnSync(
          'git',
          [
            '-c',
            'user.name=t',
            '-c',
            'user.email=t@example.com',
            '-c',
            'commit.gpgsign=false',
            '-c',
            'tag.gpgsign=false',
            ...a,
          ],
          { cwd: root, encoding: 'utf8' },
        );
        assert.equal(r.status, 0, r.stderr);
        return r.stdout.trim();
      };
      git('init', '-q', '-b', 'main');
      writeFileSync(path.join(root, 'a'), '1');
      git('add', '.');
      git('commit', '-q', '-m', 'base');
      const base = git('rev-parse', 'HEAD');
      git('switch', '-q', '-c', 'side');
      writeFileSync(path.join(root, 'b'), '2');
      git('add', '.');
      git('commit', '-q', '-m', 'side');
      const side = git('rev-parse', 'HEAD');
      git('switch', '-q', 'main');
      writeFileSync(path.join(root, 'c'), '3');
      git('add', '.');
      git('commit', '-q', '-m', 'main work');
      const mainSha = git('rev-parse', 'HEAD');
      git('merge', '-q', '--no-ff', '-m', 'merge', 'side');
      const head = git('rev-parse', 'HEAD');
      const asked: string[] = [];
      const fetchImpl = async (url: string) => {
        asked.push(url.split('/').pop() as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({ commit: { verification: { verified: true, reason: 'valid' } } }),
        };
      };
      const code = await main(['--base', base, '--head', head], ENV, {
        fetchImpl,
        cwd: root,
        out: sink(),
        err: sink(),
      });
      assert.equal(code, 0);
      assert.deepEqual(asked.sort(), [side, mainSha].sort());
      assert.ok(!asked.includes(head));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
