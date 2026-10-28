// Tests for check-journal-summary.ts: pure parsing plus the CLI against real temporary git repositories.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { commitHeadingLine, emptySections, parseHunks, touchesSummary } from './check-journal-summary.ts';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-journal-summary.ts');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'journal-sum-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

describe('pure helpers', () => {
  test('hunk parsing: single line, counted, deletion-only and several files', () => {
    const diff = [
      'diff --git a/docs/journal/2026-10-12.md b/docs/journal/2026-10-12.md',
      '--- a/docs/journal/2026-10-12.md',
      '+++ b/docs/journal/2026-10-12.md',
      '@@ -5 +5 @@ x',
      '-old',
      '+new',
      '@@ -20,0 +21,2 @@',
      '+a',
      '+b',
      '@@ -30,2 +32,0 @@',
      '-gone',
      '-gone2',
      'diff --git a/docs/journal/2026-10-13.md b/docs/journal/2026-10-13.md',
      '--- /dev/null',
      '+++ b/docs/journal/2026-10-13.md',
      '@@ -0,0 +1,3 @@',
    ].join('\n');
    assert.deepEqual(parseHunks(diff), {
      'docs/journal/2026-10-12.md': [
        { start: 5, count: 1 },
        { start: 21, count: 2 },
        { start: 32, count: 0 },
      ],
      'docs/journal/2026-10-13.md': [{ start: 1, count: 3 }],
    });
  });
  test('the commit heading line', () => {
    assert.equal(commitHeadingLine('# d\n\n## Özet\n\n## Commit günlüğü\n\n- x\n'), 5);
    assert.equal(commitHeadingLine('# d\nno heading\n'), Infinity);
  });
  test('summary touch: above the heading counts, below does not', () => {
    assert.equal(touchesSummary([{ start: 4, count: 1 }], 10), true);
    assert.equal(touchesSummary([{ start: 9, count: 0 }], 10), true);
    assert.equal(touchesSummary([{ start: 10, count: 1 }], 10), false);
    assert.equal(touchesSummary([{ start: 12, count: 2 }], 10), false);
    assert.equal(
      touchesSummary(
        [
          { start: 30, count: 1 },
          { start: 3, count: 1 },
        ],
        10,
      ),
      true,
    );
    assert.equal(
      touchesSummary([{ start: 12, count: 1 }], Infinity),
      true,
      'a file without the heading is all summary',
    );
  });
  test('empty sections: all filled, one empty, one missing, bullet only below the heading', () => {
    const full = [
      '# d',
      '## Özet',
      '### Yapılanlar',
      '- a',
      '### Kararlar / öğrenilenler',
      '* b',
      '### Yarım kalan / sıradaki',
      '- c',
      '## Commit günlüğü',
      '- `x`',
    ].join('\n');
    assert.deepEqual(emptySections(full), []);
    const noBullet = full.replace('* b', 'sadece metin');
    assert.deepEqual(emptySections(noBullet), ['### Kararlar / öğrenilenler']);
    const missing = full.replace('### Yarım kalan / sıradaki\n- c\n', '');
    assert.deepEqual(emptySections(missing), ['### Yarım kalan / sıradaki']);
    const belowOnly = ['## Özet', '### Yapılanlar', '### Kararlar / öğrenilenler', '### Yarım kalan / sıradaki', '## Commit günlüğü', '- `x`'].join('\n');
    assert.equal(emptySections(belowOnly).length, 3, 'a bullet in the commit log never fills a subsection');
    assert.equal(emptySections('## Özet\n### Yapılanlar\n- a\n').length, 2, 'a file without the heading is all summary');
  });
});

describe('CLI', () => {
  const SUMMARY = [
    '# 2026-10-12',
    '',
    '## Özet',
    '',
    '### Yapılanlar',
    '- bir',
    '',
    '### Kararlar / öğrenilenler',
    '- iki',
    '',
    '### Yarım kalan / sıradaki',
    '- üç',
    '',
    '## Commit günlüğü',
    '',
    '- `chore: base` — temel',
    '',
  ];
  const COMMIT_AT = 15;

  function sh(cwd: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
    return r.stdout.trim();
  }
  function makeRepo() {
    const repo = path.join(root, `r${counter++}`);
    mkdirSync(path.join(repo, 'docs', 'journal'), { recursive: true });
    sh(repo, 'init', '-q', '-b', 'main');
    for (const [k, v] of [
      ['user.name', 'tester'],
      ['user.email', 'tester@example.com'],
      ['commit.gpgsign', 'false'],
    ])
      sh(repo, 'config', k, v);
    writeFileSync(path.join(repo, 'docs/journal/2026-10-12.md'), SUMMARY.join('\n'));
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: base');
    const base = sh(repo, 'rev-parse', 'HEAD');
    sh(repo, 'switch', '-q', '-c', 'feat/x');
    return { repo, base };
  }
  function change(repo: string, fn: (lines: string[]) => void, file = 'docs/journal/2026-10-12.md') {
    const lines = SUMMARY.slice();
    fn(lines);
    writeFileSync(path.join(repo, file), lines.join('\n'));
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: change');
    return sh(repo, 'rev-parse', 'HEAD');
  }
  const run = (repo: string, base: string, head: string) =>
    spawnSync('node', [SCRIPT, '--base', base, '--head', head], { cwd: repo, encoding: 'utf8' });

  test('only a commit line added: fails', () => {
    const { repo, base } = makeRepo();
    const head = change(repo, (l) => l.splice(COMMIT_AT, 0, '- `chore: change` — değişiklik'));
    const r = run(repo, base, head);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /does not change the "Özet" part/);
  });
  test('a changed summary line: passes', () => {
    const { repo, base } = makeRepo();
    const head = change(repo, (l) => {
      l[5] = '- bir ve ikinci madde';
      l.splice(COMMIT_AT, 0, '- `chore: change` — değişiklik');
    });
    const r = run(repo, base, head);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /docs\/journal\/2026-10-12\.md/);
  });
  test('a removed summary line that keeps every subsection filled: passes', () => {
    const { repo, base } = makeRepo();
    const head = change(repo, (l) => l.splice(6, 1));
    assert.equal(run(repo, base, head).status, 0);
  });
  test('a summary subsection left without a bullet: fails and names it', () => {
    const { repo, base } = makeRepo();
    const head = change(repo, (l) => {
      l[8] = 'bullet yok';
    });
    const r = run(repo, base, head);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /2026-10-12\.md has no bullet under: ### Kararlar \/ öğrenilenler/);
  });
  test('a subsection removed altogether: fails', () => {
    const { repo, base } = makeRepo();
    const head = change(repo, (l) => l.splice(10, 3));
    const r = run(repo, base, head);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /### Yarım kalan \/ sıradaki/);
  });
  test('a touched file with an empty subsection fails even when another file changed its summary', () => {
    const { repo, base } = makeRepo();
    const other = SUMMARY.slice();
    other[8] = '';
    writeFileSync(path.join(repo, 'docs/journal/2026-10-13.md'), other.join('\n'));
    const head = change(repo, (l) => {
      l[5] = '- bir, güncel';
    });
    const r = run(repo, base, head);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /2026-10-13\.md has no bullet/);
  });
  test('a brand new complete journal file: passes', () => {
    const { repo, base } = makeRepo();
    const head = change(repo, () => {}, 'docs/journal/2026-10-13.md');
    assert.equal(run(repo, base, head).status, 0);
  });
  test('no journal change at all: fails', () => {
    const { repo, base } = makeRepo();
    writeFileSync(path.join(repo, 'other.txt'), 'x\n');
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: other');
    assert.equal(run(repo, base, sh(repo, 'rev-parse', 'HEAD')).status, 1);
  });
  test('a non-daily markdown file under docs/journal does not count', () => {
    const { repo, base } = makeRepo();
    writeFileSync(path.join(repo, 'docs/journal/README.md'), '# Ek\n');
    sh(repo, 'add', '-A');
    sh(repo, 'commit', '-q', '-m', 'chore: readme');
    assert.equal(run(repo, base, sh(repo, 'rev-parse', 'HEAD')).status, 1);
  });
  test('usage and git errors exit 2', () => {
    const { repo, base } = makeRepo();
    assert.equal(spawnSync('node', [SCRIPT], { cwd: repo, encoding: 'utf8' }).status, 2);
    assert.equal(run(repo, base, 'deadbeef').status, 2);
  });
});
