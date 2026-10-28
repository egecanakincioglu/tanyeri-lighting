// Tests for release-check.ts: the pure helpers plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { changelogSection, main, notesHeading, notesPath, releaseBody, versionOfTag } from './release-check.ts';

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
  test('a heading without a valid date is not a section', () => {
    assert.equal(changelogSection('## [1.0.0] - soon\n\n- x\n', '1.0.0'), null);
    assert.equal(changelogSection('## [1.0.0] - 2026-10-30 extra\n\n- x\n', '1.0.0'), null);
  });
  test('a version with regex characters is only compared as text', () => {
    assert.equal(changelogSection('## [1.0.0] - 2026-10-30\n\n- x\n', '(.*)+'), null);
  });
  test('handles CRLF line endings', () => {
    assert.equal(changelogSection(CHANGELOG.replaceAll('\n', '\r\n'), '1.0.0'), '- first release');
  });
});

describe('notes file', () => {
  test('the path is releases/<tag>.md', () => assert.equal(notesPath('0.12.3'), 'releases/v0.12.3.md'));
  test('the heading is the first line without the marker', () => {
    assert.equal(notesHeading('# v1.0.0 — First\n\nbody', '1.0.0'), 'v1.0.0 — First');
    assert.equal(notesHeading('# v1.0.0 — First\r\nbody', '1.0.0'), 'v1.0.0 — First');
  });
  for (const bad of [
    '# v1.0.1 — x',
    '# v1.0.0 - x',
    '# v1.0.0 — ',
    '## v1.0.0 — x',
    'v1.0.0 — x',
    '',
    '\n# v1.0.0 — x',
  ])
    test(`rejects the first line ${JSON.stringify(bad)}`, () => assert.equal(notesHeading(bad, '1.0.0'), null));
  test('the body drops the first line and folds the commit list into details', () => {
    assert.equal(
      releaseBody('# v1.0.0 — T\n\nBody\n', '- a (x)'),
      'Body\n\n<details>\n<summary>Commit list</summary>\n\n- a (x)\n</details>\n',
    );
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
    mkdirSync(path.join(repo, 'releases'), { recursive: true });
    writeFileSync(path.join(repo, 'releases', `v${version}.md`), `# v${version} — Title\n\nBody\n`);
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
  test('notes: writes the notes file body followed by the commit list', () => {
    const repo = makeRepo('1.0.0');
    const out = path.join(repo, 'notes.md');
    assert.equal(main(['notes', 'v1.0.0', out], repo), 0);
    assert.equal(
      readFileSync(out, 'utf8'),
      'Body\n\n<details>\n<summary>Commit list</summary>\n\n- first release\n</details>\n',
    );
  });
  test('title: prints the heading of the notes file', () => {
    const repo = makeRepo('1.0.0');
    const write = process.stdout.write;
    let printed = '';
    process.stdout.write = ((chunk: string) => ((printed += chunk), true)) as typeof process.stdout.write;
    try {
      assert.equal(main(['title', 'v1.0.0'], repo), 0);
    } finally {
      process.stdout.write = write;
    }
    assert.equal(printed, 'v1.0.0 — Title\n');
  });
  const failsBoth = (repo: string) => {
    assert.equal(
      quiet(() => main(['title', 'v1.0.0'], repo)),
      1,
    );
    assert.equal(
      quiet(() => main(['notes', 'v1.0.0', path.join(repo, 'n.md')], repo)),
      1,
    );
  };
  test('title and notes: a missing notes file fails', () => {
    const repo = makeRepo('1.0.0');
    rmSync(path.join(repo, 'releases', 'v1.0.0.md'));
    failsBoth(repo);
  });
  test('title and notes: a draft with the placeholder fails', () => {
    const repo = makeRepo('1.0.0');
    writeFileSync(path.join(repo, 'releases', 'v1.0.0.md'), '# v1.0.0 — Title\n\n<!-- fill in -->\n');
    failsBoth(repo);
  });
  test('title and notes: only the summary placeholder left fails', () => {
    const repo = makeRepo('1.0.0');
    const summary = '> <!-- fill in: summary, number of commits, migrations -->';
    writeFileSync(path.join(repo, 'releases', 'v1.0.0.md'), `# v1.0.0 — Title\n\n${summary}\n\n- Migrations: none\n`);
    failsBoth(repo);
  });
  test('title and notes: a wrong first line fails', () => {
    const repo = makeRepo('1.0.0');
    writeFileSync(path.join(repo, 'releases', 'v1.0.0.md'), '# Title\n\nBody\n');
    failsBoth(repo);
  });
  test('notes: a missing changelog section fails', () => {
    const repo = makeRepo('1.0.0');
    writeFileSync(path.join(repo, 'releases', 'v2.0.0.md'), '# v2.0.0 — Title\n\nBody\n');
    assert.equal(
      quiet(() => main(['notes', 'v2.0.0', path.join(repo, 'n.md')], repo)),
      1,
    );
  });
  test('usage errors exit 2', () => {
    for (const argv of [[], ['verify'], ['verify', '1.0.0'], ['notes', 'v1.0.0'], ['title'], ['publish', 'v1.0.0']])
      assert.equal(
        quiet(() => main(argv)),
        2,
        argv.join(' '),
      );
  });
});
