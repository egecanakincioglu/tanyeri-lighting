// Tests for check-release-version.ts: the pure rules plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { check, compareVersions } from './check-release-version.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-release-version.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'release-ver-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

describe('compareVersions', () => {
  test('compares numerically, not as text', () => {
    assert.ok((compareVersions('1.10.0', '1.9.0') as number) > 0);
    assert.ok((compareVersions('0.9.9', '1.0.0') as number) < 0);
    assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  });
  test('anything but X.Y.Z is null', () => {
    assert.equal(compareVersions('1.0.0-rc.1', '1.0.0'), null);
    assert.equal(compareVersions('1.0', '1.0.0'), null);
  });
});

describe('check', () => {
  const notes = (v: string): string => `# v${v} — Title\n\nBody\n`;
  const base = { version: '1.0.0', changelog: 'a', notes: notes('1.0.0') };
  test('nothing changed passes', () => assert.deepEqual(check(base, base), []));
  test('a changelog-only change passes', () => assert.deepEqual(check(base, { ...base, changelog: 'b' }), []));
  test('a bump with a changelog change and notes passes', () => {
    assert.deepEqual(check(base, { version: '1.0.1', changelog: 'b', notes: notes('1.0.1') }), []);
  });
  test('a bump without a changelog change fails', () => {
    assert.deepEqual(check(base, { ...base, version: '1.1.0', notes: notes('1.1.0') }), [
      'the version changed but CHANGELOG.md did not',
    ]);
  });
  test('a lowered version fails', () => {
    assert.match(check(base, { version: '0.9.0', changelog: 'b', notes: notes('0.9.0') })[0] as string, /must go up/);
  });
  test('a pre-release version fails', () => {
    const head = { version: '1.1.0-rc.1', changelog: 'b', notes: notes('1.1.0-rc.1') };
    assert.match(check(base, head)[0] as string, /X\.Y\.Z/);
  });
  test('a changelog and notes added together with a bump pass', () => {
    const before = { version: '0.0.0', changelog: null, notes: null };
    assert.deepEqual(check(before, { version: '0.1.0', changelog: 'x', notes: notes('0.1.0') }), []);
  });
  test('a bump without a notes file fails', () => {
    const [problem] = check(base, { version: '1.1.0', changelog: 'b', notes: null });
    assert.match(problem as string, /releases\/v1\.1\.0\.md does not exist/);
  });
  test('a notes file with a placeholder fails', () => {
    const [problem] = check(base, { version: '1.1.0', changelog: 'b', notes: '# v1.1.0 — <!-- fill in -->\n' });
    assert.match(problem as string, /still contains/);
  });
  test('a notes file with only the summary placeholder left fails', () => {
    const notes = '# v1.1.0 — Title\n\n> <!-- fill in: summary -->\n';
    assert.match(check(base, { version: '1.1.0', changelog: 'b', notes })[0] as string, /still contains/);
  });
  test('a notes file of another version or without a title fails', () => {
    assert.match(check(base, { version: '1.1.0', changelog: 'b', notes: notes('1.0.0') })[0] as string, /first line/);
    assert.match(check(base, { version: '1.1.0', changelog: 'b', notes: '# v1.1.0 — \n' })[0] as string, /first line/);
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
    spawnSync('git', ['init', '-q', '-b', 'main', repo]);
    for (const [k, v] of [
      ['user.name', 'tester'],
      ['user.email', 'tester@example.com'],
      ['commit.gpgsign', 'false'],
    ])
      sh(repo, 'config', k, v);
    return repo;
  }
  function commit(repo: string, version: string, changelog: string, notes?: string): string {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ version }));
    writeFileSync(path.join(repo, 'CHANGELOG.md'), changelog);
    mkdirSync(path.join(repo, 'releases'), { recursive: true });
    writeFileSync(path.join(repo, 'releases', `v${version}.md`), notes ?? `# v${version} — Title\n\nBody\n`);
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '--allow-empty', '-m', 'chore: change');
    return sh(repo, 'rev-parse', 'HEAD');
  }
  const run = (repo: string, base: string, head: string) =>
    spawnSync('node', [SCRIPT, '--base', base, '--head', head], { cwd: repo, encoding: 'utf8' });

  test('version bumped upward with a changelog change: passes', () => {
    const repo = makeRepo();
    const base = commit(repo, '1.0.0', 'a');
    assert.equal(run(repo, base, commit(repo, '1.1.0', 'b')).status, 0);
  });
  test('version bumped with an unfinished notes file: fails', () => {
    const repo = makeRepo();
    const base = commit(repo, '1.0.0', 'a');
    const r = run(repo, base, commit(repo, '1.1.0', 'b', '# v1.1.0 — <!-- fill in -->\n'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /still contains/);
  });
  test('version bumped without a notes file: fails', () => {
    const repo = makeRepo();
    const base = commit(repo, '1.0.0', 'a');
    commit(repo, '1.1.0', 'b');
    sh(repo, 'rm', '-q', 'releases/v1.1.0.md');
    sh(repo, 'commit', '-q', '-m', 'chore: drop notes');
    const r = run(repo, base, sh(repo, 'rev-parse', 'HEAD'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not exist/);
  });
  test('version untouched: passes', () => {
    const repo = makeRepo();
    const base = commit(repo, '1.0.0', 'a');
    assert.equal(run(repo, base, commit(repo, '1.0.0', 'a')).status, 0);
  });
  test('version bumped without a changelog change: fails', () => {
    const repo = makeRepo();
    const base = commit(repo, '1.0.0', 'a');
    const r = run(repo, base, commit(repo, '1.1.0', 'a'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /CHANGELOG\.md did not/);
  });
  test('version lowered: fails', () => {
    const repo = makeRepo();
    const base = commit(repo, '1.1.0', 'a');
    const r = run(repo, base, commit(repo, '1.0.0', 'b'));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /must go up/);
  });
  test('no changelog in base, added in head with a bump: passes', () => {
    const repo = makeRepo();
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ version: '0.0.0' }));
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: first');
    const base = sh(repo, 'rev-parse', 'HEAD');
    assert.equal(run(repo, base, commit(repo, '0.1.0', 'x')).status, 0);
  });
  test('unknown ref: usage error', () => {
    const repo = makeRepo();
    const head = commit(repo, '1.0.0', 'a');
    assert.equal(run(repo, 'deadbeef', head).status, 2);
  });
  test('missing arguments: usage error', () => {
    assert.equal(spawnSync('node', [SCRIPT], { encoding: 'utf8' }).status, 2);
  });
});
