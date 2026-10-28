// Tests for release-prepare.ts: pure helpers and a run against a temporary git repository.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import {
  compareVersions,
  insertSection,
  main,
  nextVersion,
  parseCommit,
  renderSection,
  setPackageVersion,
} from './release-prepare.ts';

const c = (subject: string, body = '', sha = 'abc1234') => parseCommit(sha, subject, body);

describe('parseCommit', () => {
  test('reads type, scope and summary', () => {
    const x = c('feat(ui): add a menu');
    assert.deepEqual([x.type, x.summary, x.breaking], ['feat', 'add a menu', false]);
  });
  test('detects ! and BREAKING CHANGE footers', () => {
    assert.equal(c('feat!: drop the old api').breaking, true);
    assert.equal(c('fix: x', 'details\n\nBREAKING CHANGE: gone').breaking, true);
  });
  test('a non-conventional header is other', () => assert.equal(c('Update things').type, 'other'));
});

describe('versions', () => {
  test('fix gives PATCH, feat gives MINOR', () => {
    assert.equal(nextVersion('1.2.3', [c('fix: a')]), '1.2.4');
    assert.equal(nextVersion('1.2.3', [c('fix: a'), c('feat: b')]), '1.3.0');
  });
  test('breaking gives MAJOR from 1.0.0 and MINOR below it', () => {
    assert.equal(nextVersion('1.2.3', [c('feat!: a')]), '2.0.0');
    assert.equal(nextVersion('0.4.1', [c('fix: a', 'BREAKING CHANGE: b')]), '0.5.0');
  });
  test('only other types suggest PATCH', () => assert.equal(nextVersion('0.1.0', [c('ci: a')]), '0.1.1'));
  test('first release from 0.0.0 with a feat is 0.1.0', () =>
    assert.equal(nextVersion('0.0.0', [c('feat: a')]), '0.1.0'));
  test('compareVersions orders numerically', () => {
    assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
    assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
    assert.throws(() => compareVersions('1.0', '1.0.0'));
  });
});

describe('sections', () => {
  const commits = [
    c('feat: add the app', '', 'a1'),
    c('fix(i18n): give titles', '', 'b2'),
    c('ci: add a build job', '', 'c3'),
    c('refactor!: rename', '', 'd4'),
  ];
  test('groups commits and skips empty headings', () => {
    assert.equal(
      renderSection('0.1.0', '2026-10-28', commits),
      [
        '## [0.1.0] - 2026-10-28',
        '',
        '### Breaking changes',
        '- refactor!: rename (d4)',
        '',
        '### Features',
        '- add the app (a1)',
        '',
        '### Fixes',
        '- give titles (b2)',
        '',
        '### Other',
        '- ci: add a build job (c3)',
        '- refactor!: rename (d4)',
        '',
      ].join('\n'),
    );
    assert.ok(!renderSection('0.1.1', '2026-10-28', [c('ci: x')]).includes('### Features'));
  });
  test('insertSection goes above the newest section', () => {
    const out = insertSection('# Changelog\n\nintro\n\n## [0.1.0] - d\n\n### Fixes\n- a (x)\n', '## [0.2.0] - d\n');
    assert.ok(out.indexOf('## [0.2.0]') < out.indexOf('## [0.1.0]'));
    assert.ok(insertSection('# Changelog\n', '## [0.1.0] - d\n').endsWith('## [0.1.0] - d\n'));
  });
  test('setPackageVersion keeps the rest of the file', () => {
    const text = '{\n  "name": "x",\n  "version": "0.0.0",\n  "private": true\n}\n';
    assert.equal(setPackageVersion(text, '0.1.0'), text.replace('0.0.0', '0.1.0'));
    assert.throws(() => setPackageVersion('{}', '0.1.0'));
  });
});

describe('main in a temporary repository', () => {
  const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'release-prepare-'));
  after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  const commit = (msg: string) => git('commit', '--allow-empty', '-m', msg);
  const run = (...args: string[]): number => {
    const out = process.stdout.write;
    const err = process.stderr.write;
    process.stdout.write = () => true;
    process.stderr.write = () => true;
    try {
      return main(args, root, '2026-10-28');
    } finally {
      process.stdout.write = out;
      process.stderr.write = err;
    }
  };
  const read = (name: string) => readFileSync(path.join(root, name), 'utf8');

  test('dry run writes nothing, a real run writes both files, a later run uses the tag', () => {
    git('init', '-q');
    writeFileSync(path.join(root, 'package.json'), '{\n  "version": "0.0.0"\n}\n');
    git('add', '.');
    commit('feat: first');
    commit('fix: second');

    assert.equal(run('--dry-run'), 0);
    assert.equal(existsSync(path.join(root, 'CHANGELOG.md')), false);
    assert.match(read('package.json'), /"0\.0\.0"/);

    assert.equal(run('--version', '0.0.0'), 1);
    assert.equal(run('--version', 'abc'), 2);

    assert.equal(run(), 0);
    assert.match(read('package.json'), /"0\.1\.0"/);
    assert.match(
      read('CHANGELOG.md'),
      /^# Changelog\n\nAll notable changes[^\n]*\n\n## \[0\.1\.0\] - 2026-10-28\n\n### Features\n- first \([0-9a-f]+\)/,
    );

    git('tag', 'v0.1.0');
    assert.equal(run(), 1);
    commit('fix: third');
    assert.equal(run('--version', '0.1.0'), 1);
    assert.equal(run(), 0);
    assert.match(read('package.json'), /"0\.1\.1"/);
    const log = read('CHANGELOG.md');
    assert.ok(log.indexOf('## [0.1.1]') < log.indexOf('## [0.1.0]'));
  });

  test('a changelog that cannot be read is an error, not a missing file', () => {
    rmSync(path.join(root, 'CHANGELOG.md'));
    mkdirSync(path.join(root, 'CHANGELOG.md'));
    commit('fix: fourth');
    assert.equal(run(), 2);
  });
});
