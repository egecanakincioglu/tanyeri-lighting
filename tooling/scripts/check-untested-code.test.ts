// Tests for check-untested-code.ts: pure helpers plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { commitType, evaluate, isGatedSource, isTestFile, parseLog } from './check-untested-code.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-untested-code.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'untested-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

describe('file classification', () => {
  test('gated source: TypeScript under src/, not tests, not declarations', () => {
    for (const f of ['src/a.ts', 'src/lib/b.tsx', 'src/c.mts', 'src/d.cts', 'apps/web/src/x/y.ts'])
      assert.equal(isGatedSource(f), true, f);
    for (const f of [
      'src/a.test.ts',
      'src/a.spec.tsx',
      'src/__tests__/helper.ts',
      'src/types.d.ts',
      'src/types.d.mts',
      'src/a.js',
      'src/a.css',
      'lib/a.ts',
      'tooling/scripts/a.mjs',
      'server.ts',
      'mysrc/a.ts',
    ])
      assert.equal(isGatedSource(f), false, f);
  });
  test('test files', () => {
    for (const f of ['a.test.ts', 'src/a.test.tsx', 'x.test.mts', 'x.test.cts', 'tooling/a.test.mjs', 'a.spec.ts', 'a.spec.js', 'src/__tests__/a.ts'])
      assert.equal(isTestFile(f), true, f);
    for (const f of ['src/a.ts', 'a.test.js', 'test.ts', 'src/latest.ts', 'a.test.md'])
      assert.equal(isTestFile(f), false, f);
  });
  test('commit types', () => {
    assert.equal(commitType('feat(api): add x'), 'feat');
    assert.equal(commitType('fix!: break it'), 'fix');
    assert.equal(commitType('revert: undo'), 'revert');
    assert.equal(commitType('Merge branch x'), null);
    assert.equal(commitType('no type here'), null);
  });
});

describe('log parsing', () => {
  test('commits with their files and statuses', () => {
    const text = '\x01aaa\tfeat(x): add\nA\tsrc/a.ts\nM\tsrc/b.ts\n\n\x01bbb\tdocs: d\nD\tdocs/x.md\n';
    assert.deepEqual(parseLog(text), [
      {
        sha: 'aaa',
        header: 'feat(x): add',
        files: [
          { status: 'A', file: 'src/a.ts' },
          { status: 'M', file: 'src/b.ts' },
        ],
      },
      { sha: 'bbb', header: 'docs: d', files: [{ status: 'D', file: 'docs/x.md' }] },
    ]);
  });
});

describe('decision', () => {
  const c = (header: string, ...files: string[]) => ({
    sha: header,
    header,
    files: files.map((f) => ({ status: f[0], file: f.slice(2) })),
  });
  test('gated type with source and no test anywhere: offender', () => {
    const r = evaluate([c('feat: x', 'A src/a.ts', 'M src/b.tsx')]);
    assert.equal(r.ok, false);
    assert.deepEqual(r.offenders, [{ sha: 'feat: x', header: 'feat: x', files: ['src/a.ts', 'src/b.tsx'] }]);
  });
  test('every commit type except style is checked', () => {
    for (const t of ['feat', 'fix', 'refactor', 'perf', 'revert', 'docs', 'ci', 'build', 'chore', 'test'])
      assert.equal(evaluate([c(`${t}: x`, 'M src/a.ts')]).ok, false, t);
  });
  test('a style commit never offends', () => {
    assert.equal(evaluate([c('style(x): format', 'M src/a.ts')]).ok, true);
  });
  test('a header without a type is gated', () => {
    assert.equal(evaluate([c('Update stuff', 'M src/a.ts')]).ok, false);
  });
  test('a chore touching source is satisfied by a test in the range', () => {
    assert.equal(evaluate([c('chore: x', 'M src/a.ts'), c('test: x', 'A src/a.test.ts')]).ok, true);
  });
  test('a test file anywhere in the range satisfies every offender, also from another commit', () => {
    const r = evaluate([c('fix: x', 'M src/a.ts'), c('test: x', 'A src/a.test.ts')]);
    assert.equal(r.ok, true);
    assert.equal(evaluate([c('fix: x', 'M src/a.ts'), c('chore: x', 'M tooling/a.test.mjs')]).ok, true);
  });
  test('a deleted test file does not count', () => {
    assert.equal(evaluate([c('fix: x', 'M src/a.ts', 'D src/a.test.ts')]).ok, false);
  });
  test('deletion-only source changes are exempt', () => {
    assert.equal(evaluate([c('refactor: remove dead code', 'D src/a.ts', 'D src/b.ts')]).ok, true);
  });
  test('test, declaration and non-source files do not make a commit gated', () => {
    assert.equal(evaluate([c('feat: x', 'A src/a.d.ts', 'M README.md', 'M server.ts')]).ok, true);
  });
  test('only the offending commits are listed', () => {
    const r = evaluate([c('feat: a', 'A src/a.ts'), c('fix: b', 'M docs/x.md'), c('perf: c', 'M src/c.mts')]);
    assert.deepEqual(
      r.offenders.map((o) => o.header),
      ['feat: a', 'perf: c'],
    );
  });
});

describe('CLI', () => {
  function sh(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  }
  function makeRepo() {
    const repo = path.join(root, `r${counter++}`);
    mkdirSync(repo, { recursive: true });
    sh(repo, 'init', '-q', '-b', 'main');
    for (const [k, v] of [
      ['user.name', 'tester'],
      ['user.email', 'tester@example.com'],
      ['commit.gpgsign', 'false'],
    ])
      sh(repo, 'config', k, v);
    mkdirSync(path.join(repo, 'src'), { recursive: true });
    writeFileSync(path.join(repo, 'src/old.ts'), 'export const old = 1;\n');
    writeFileSync(path.join(repo, 'src/old.test.ts'), 'export {};\n');
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: base');
    const base = sh(repo, 'rev-parse', 'HEAD');
    sh(repo, 'switch', '-q', '-c', 'feat/x');
    const commit = (header: string, files: Record<string, string>, removed: string[] = []) => {
      for (const [rel, text] of Object.entries(files)) {
        mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
        writeFileSync(path.join(repo, rel), text);
      }
      for (const rel of removed) rmSync(path.join(repo, rel));
      sh(repo, 'add', '-A');
      sh(repo, 'commit', '-q', '-m', header);
    };
    return { repo, base, commit, head: () => sh(repo, 'rev-parse', 'HEAD') };
  }
  const run = (repo: string, base: string, head: string) =>
    spawnSync('node', [SCRIPT, '--base', base, '--head', head], { cwd: repo, encoding: 'utf8' });

  test('a feat with source and no test fails and lists the commit and its files', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('feat(api): add endpoint', { 'src/api.ts': 'export const a = 1;\n' });
    const r = run(repo, base, head());
    assert.equal(r.status, 1);
    assert.match(r.stderr, /feat\(api\): add endpoint/);
    assert.match(r.stderr, /src\/api\.ts/);
  });
  test('every offending commit is listed', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('feat: one', { 'src/one.ts': '1\n' });
    commit('fix: two', { 'src/two.tsx': '2\n' });
    const r = run(repo, base, head());
    assert.equal(r.status, 1);
    assert.match(r.stderr, /feat: one/);
    assert.match(r.stderr, /fix: two/);
  });
  test('a test file added in the same range passes, even in a later commit', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('fix: bug', { 'src/api.ts': 'export const a = 2;\n' });
    commit('test: cover bug', { 'src/api.test.ts': 'export {};\n' });
    const r = run(repo, base, head());
    assert.equal(r.status, 0, r.stderr);
  });
  test('a modified existing test file passes', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('refactor: tidy', { 'src/old.ts': 'export const old = 2;\n', 'src/old.test.ts': 'export const t = 1;\n' });
    assert.equal(run(repo, base, head()).status, 0);
  });
  test('a style commit passes without a test', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('style: format', { 'src/old.ts': 'export const   old = 1;\n' });
    assert.equal(run(repo, base, head()).status, 0);
  });
  test('chore, ci, build, test and docs commits that change source need a test', () => {
    for (const t of ['chore', 'ci', 'build', 'test', 'docs']) {
      const { repo, base, commit, head } = makeRepo();
      commit(`${t}: change`, { 'src/more.ts': 'export {};\n' });
      const r = run(repo, base, head());
      assert.equal(r.status, 1, t);
      assert.match(r.stderr, new RegExp(`${t}: change`));
    }
  });
  test('a chore that changes source passes when the range changes a test', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('chore: deps', { 'src/more.ts': 'export {};\n' });
    commit('test: cover', { 'src/more.test.ts': 'export {};\n' });
    assert.equal(run(repo, base, head()).status, 0);
  });
  test('a chore that changes only non-source files passes', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('chore: tooling', { 'tooling/x.mjs': 'export {};\n', 'package.json': '{}\n' });
    assert.equal(run(repo, base, head()).status, 0);
  });
  test('a deletion-only refactor passes', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('refactor: drop dead code', {}, ['src/old.ts']);
    assert.equal(run(repo, base, head()).status, 0);
  });
  test('a feat that only touches non-source files passes', () => {
    const { repo, base, commit, head } = makeRepo();
    commit('feat: copy', { 'public/a.txt': 'x\n', 'src/types.d.ts': 'export {};\n' });
    assert.equal(run(repo, base, head()).status, 0);
  });
  test('an empty range passes', () => {
    const { repo, base } = makeRepo();
    assert.equal(run(repo, base, base).status, 0);
  });
  test('usage and git errors exit 2', () => {
    const { repo, base } = makeRepo();
    assert.equal(spawnSync('node', [SCRIPT], { cwd: repo, encoding: 'utf8' }).status, 2);
    assert.equal(run(repo, base, 'deadbeef').status, 2);
  });
});
