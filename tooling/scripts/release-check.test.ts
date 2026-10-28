// Tests for release-check.ts: the pure helpers plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { changelogSection, main, versionOfTag } from './release-check.ts';

const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'release-check-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

const CHANGELOG = [
  '# Changelog',
  '',
  '## [1.1.0] - 2026-11-02',
  '',
  '- feature',
  '',
  '## [1.0.0] - 2026-10-30',
  '',
  '- first release',
  '',
  '## [0.9.0] - 2026-10-01',
  '',
].join('\n');

describe('versionOfTag', () => {
  test('accepts vX.Y.Z', () => assert.equal(versionOfTag('v1.20.3'), '1.20.3'));
  for (const bad of ['1.0.0', 'v1.0', 'v1.0.0-rc.1', 'v1.0.0.0', 'release-1.0.0'])
    test(`rejects ${bad}`, () => assert.equal(versionOfTag(bad), null));
});

describe('changelogSection', () => {
  test('returns the section up to the next heading', () => {
    assert.equal(changelogSection(CHANGELOG, '1.0.0'), '- first release');
  });
  test('the newest section ends at the next heading too', () => {
    assert.equal(changelogSection(CHANGELOG, '1.1.0'), '- feature');
  });
  test('an unknown version is null', () => assert.equal(changelogSection(CHANGELOG, '2.0.0'), null));
  test('an empty section is null', () => assert.equal(changelogSection(CHANGELOG, '0.9.0'), null));
  test('a version is not matched by prefix or by regex dots', () => {
    assert.equal(changelogSection('## [1.0.0] - 2026-10-30\n\n- x\n', '1.0'), null);
    assert.equal(changelogSection('## [1x0x0] - 2026-10-30\n\n- x\n', '1.0.0'), null);
  });
  test('handles CRLF line endings', () => {
    assert.equal(changelogSection(CHANGELOG.replaceAll('\n', '\r\n'), '1.0.0'), '- first release');
  });
});

describe('CLI', () => {
  function sh(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  }
  function commit(repo: string, version: string) {
    writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ version }));
    writeFileSync(path.join(repo, 'CHANGELOG.md'), CHANGELOG);
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', `chore: ${version}`);
  }
  function makeRepo(version: string) {
    const repo = path.join(root, `r${counter++}`);
    spawnSync('git', ['init', '-q', '-b', 'main', repo]);
    for (const [k, v] of [
      ['user.name', 'tester'],
      ['user.email', 'tester@example.com'],
      ['commit.gpgsign', 'false'],
      ['tag.gpgsign', 'false'],
    ])
      sh(repo, 'config', k, v);
    commit(repo, version);
    return repo;
  }
  const quiet = (fn: () => number) => {
    const write = process.stderr.write;
    process.stderr.write = () => true;
    try {
      return fn();
    } finally {
      process.stderr.write = write;
    }
  };

  test('verify: a tag on main that matches package.json passes', () => {
    const repo = makeRepo('1.0.0');
    sh(repo, 'tag', 'v1.0.0');
    assert.equal(main(['verify', 'v1.0.0', 'main'], repo), 0);
  });
  test('verify: a tag in the history of main passes', () => {
    const repo = makeRepo('1.0.0');
    sh(repo, 'tag', 'v1.0.0');
    commit(repo, '1.1.0');
    sh(repo, 'checkout', '-q', 'v1.0.0');
    assert.equal(main(['verify', 'v1.0.0', 'main'], repo), 0);
  });
  test('verify: a tag whose version differs from package.json fails', () => {
    const repo = makeRepo('1.0.0');
    sh(repo, 'tag', 'v1.0.1');
    assert.equal(
      quiet(() => main(['verify', 'v1.0.1', 'main'], repo)),
      1,
    );
  });
  test('verify: a tag on a side branch fails', () => {
    const repo = makeRepo('1.0.0');
    sh(repo, 'switch', '-q', '-c', 'side');
    commit(repo, '1.1.0');
    sh(repo, 'tag', 'v1.1.0');
    assert.equal(
      quiet(() => main(['verify', 'v1.1.0', 'main'], repo)),
      1,
    );
  });
  test('verify: an annotated tag is resolved to its commit', () => {
    const repo = makeRepo('1.0.0');
    sh(repo, 'tag', '-a', 'v1.0.0', '-m', 'release');
    assert.equal(main(['verify', 'v1.0.0', 'main'], repo), 0);
  });
  test('notes: writes the section of the version', () => {
    const repo = makeRepo('1.0.0');
    const out = path.join(repo, 'notes.md');
    assert.equal(main(['notes', 'v1.0.0', out], repo), 0);
    assert.equal(readFileSync(out, 'utf8'), '- first release\n');
  });
  test('notes: a missing section fails', () => {
    const repo = makeRepo('1.0.0');
    assert.equal(
      quiet(() => main(['notes', 'v2.0.0', path.join(repo, 'n.md')], repo)),
      1,
    );
  });
  test('usage errors exit 2', () => {
    for (const argv of [[], ['verify'], ['verify', '1.0.0'], ['notes', 'v1.0.0'], ['publish', 'v1.0.0']])
      assert.equal(
        quiet(() => main(argv)),
        2,
        argv.join(' '),
      );
  });
});
