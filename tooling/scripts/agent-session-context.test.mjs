// Tests for agent-session-context.mjs. Real temporary git repositories; nothing is mocked.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  capLines,
  formatLocal,
  formatPrLines,
  openRoadmapItems,
  sectionLines,
  summarizeDoctor,
} from './agent-session-context.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-session-context.mjs');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'ctx-test-'));

function sh(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function write(repo, rel, text) {
  const file = path.join(repo, rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

function makeRepo(name) {
  const dir = path.join(root, name);
  mkdirSync(dir, { recursive: true });
  sh(dir, 'init', '-q', '-b', 'main');
  sh(dir, 'config', 'user.name', 'tester');
  sh(dir, 'config', 'user.email', 'tester@example.com');
  sh(dir, 'config', 'commit.gpgsign', 'false');
  write(
    dir,
    'docs/roadmap.md',
    [
      '# Yol haritası',
      '',
      '## Mevcut durum',
      '',
      '- **Faz:** Faz 2 sürüyor',
      '',
      '## İlerleme',
      '',
      '### Kurulum',
      '- [x] ~~Bitti~~',
      '- [ ] Açık kurulum maddesi',
      '',
      '### Revizyon',
      '- [x] ~~Kapalı~~',
      '- [ ] Açık revizyon maddesi',
      '',
    ].join('\n'),
  );
  write(dir, 'docs/journal/2026-10-11.md', '# 2026-10-11\n\n## Özet\n\n### Yarım kalan / sıradaki\n- eski\n');
  write(
    dir,
    'docs/journal/2026-10-12.md',
    [
      '# 2026-10-12',
      '',
      '## Özet',
      '',
      '### Yapılanlar',
      '- x yapıldı',
      '### Yarım kalan / sıradaki',
      '- hook yazılacak',
      '',
      '## Commit günlüğü',
      '',
      '- `chore: one` — bir',
      '',
    ].join('\n'),
  );
  write(dir, 'docs/journal/README.md', '# Günlük\n');
  write(dir, 'docs/plans/2026-10-12-revizyon.md', '# Revizyon planı\n');
  sh(dir, 'add', '-A');
  sh(dir, 'commit', '-q', '-m', 'chore: init');
  return dir;
}

function runContext(repo, { agentDir, stdin = '{"session_id":"sess-1"}', args } = {}) {
  const argv = args ?? (agentDir ? ['--agent-dir', agentDir] : []);
  const r = spawnSync('node', [SCRIPT, ...argv], {
    cwd: repo,
    input: stdin,
    encoding: 'utf8',
    // deterministic "GitHub unreachable": no credentials, and the temp repo has no remote anyway
    env: { ...process.env, GH_TOKEN: 'invalid', GITHUB_TOKEN: 'invalid', GH_PROMPT_DISABLED: '1' },
  });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(typeof out.hookSpecificOutput.additionalContext, 'string');
  return out.hookSpecificOutput.additionalContext;
}

let repo;
let agentDir;

before(() => {
  repo = makeRepo('repo');
  agentDir = path.join(repo, '.agentcfg');
  mkdirSync(agentDir, { recursive: true });
  appendFileSync(path.join(repo, '.git', 'info', 'exclude'), '.agentcfg/\n');
  writeFileSync(path.join(agentDir, 'handoff.md'), '# Devir notu\n\nkaldığımız yer: test\n');
});

after(() => rmSync(root, { recursive: true, force: true }));

describe('pure helpers', () => {
  test('sectionLines stops at the next heading', () => {
    assert.deepEqual(sectionLines('## A\nx\ny\n## B\nz', /^## A/, /^## /), ['x', 'y']);
  });
  test('open roadmap items are grouped under their heading once', () => {
    const text =
      '## Fazlar\n### A\n- [x] done\n- [ ] one\n- [ ] two\n### B\n- [x] done\n### C\n- [ ] three\n## Other\n- [ ] orphan';
    assert.deepEqual(openRoadmapItems(text), [
      '### A',
      '- [ ] one',
      '- [ ] two',
      '### C',
      '- [ ] three',
      '- [ ] orphan',
    ]);
  });
  test('pull request lines count pass / fail / pending', () => {
    const lines = formatPrLines([
      {
        number: 7,
        title: 'feat: x',
        headRefName: 'feat/x',
        statusCheckRollup: [
          { conclusion: 'SUCCESS' },
          { conclusion: 'SKIPPED' },
          { conclusion: 'FAILURE' },
          { conclusion: '' },
          { conclusion: null },
          { conclusion: 'STALE' },
        ],
      },
      { number: 8, title: 'docs: y', headRefName: 'docs/y', statusCheckRollup: null },
    ]);
    assert.equal(lines[0], '#7 feat: x [feat/x] — checks: 2 pass / 1 fail / 3 pending');
    assert.equal(lines[1], '#8 docs: y [docs/y] — checks: 0 pass / 0 fail / 0 pending');
  });
  test('local time format', () => {
    assert.match(formatLocal(new Date(2026, 9, 12, 4, 7)), /^2026-10-12 04:07$/);
  });
  test('capLines keeps short lists and truncates long ones', () => {
    assert.deepEqual(capLines(['a', 'b'], 2), ['a', 'b']);
    assert.deepEqual(capLines(['a', 'b', 'c'], 2), ['a', 'b', '... (+1 satır daha)']);
  });
  test('doctor summary reads a check array, an object with checks, and failures/warnings arrays', () => {
    const checks = [
      { name: 'node', level: 'ok', detail: 'fine' },
      { name: 'hooks', level: 'error', detail: 'not set' },
      { name: 'gh', status: 'warn', message: 'not logged in' },
    ];
    for (const data of [checks, { checks }]) {
      const s = summarizeDoctor(data);
      assert.deepEqual(
        s.failures.map((i) => i.name),
        ['hooks'],
      );
      assert.deepEqual(
        s.warnings.map((i) => [i.name, i.detail]),
        [['gh', 'not logged in']],
      );
    }
    const s = summarizeDoctor({ failures: ['a'], warnings: [{ name: 'b', detail: 'c' }] });
    assert.equal(s.failures[0].name, 'a');
    assert.equal(s.warnings[0].detail, 'c');
    assert.deepEqual(summarizeDoctor(42), { failures: [], warnings: [] });
    assert.deepEqual(summarizeDoctor(null), { failures: [], warnings: [] });
  });
});

describe('session context', () => {
  test('emits the hook JSON with all sections in order', () => {
    const ctx = runContext(repo, { agentDir });
    const headings = [
      '## Devir notu (güncelleme: ',
      'kaldığımız yer: test',
      '## Git durumu',
      '- Dal: main',
      "## Açık PR'lar",
      '## Yol haritası',
      '### Mevcut durum\n- **Faz:** Faz 2 sürüyor',
      '### Açık maddeler',
      '### Kurulum\n- [ ] Açık kurulum maddesi',
      '### Revizyon\n- [ ] Açık revizyon maddesi',
      '## Son günlük özeti (docs/journal/2026-10-12.md)',
      '### Yarım kalan / sıradaki\n- hook yazılacak',
      '## Planlar',
      '- docs/plans/2026-10-12-revizyon.md — Revizyon planı',
      'kısa bir "kaldığımız yer" özeti',
    ];
    let at = -1;
    for (const heading of headings) {
      const i = ctx.indexOf(heading);
      assert.ok(i > at, `missing or out of order: ${heading}\n----\n${ctx}`);
      at = i;
    }
    assert.ok(!ctx.includes('- [x]'), 'closed roadmap items must not be listed');
    assert.ok(!ctx.includes('chore: one'), 'only the summary of the journal is shown, not the commit log');
  });

  test('reports a dirty working tree and a clean one', () => {
    assert.ok(runContext(repo, { agentDir }).includes('Çalışma ağacı temiz'));
    writeFileSync(path.join(repo, 'docs', 'journal', 'README.md'), '# Günlük\nedit\n');
    try {
      const ctx = runContext(repo, { agentDir });
      assert.ok(ctx.includes('Çalışma ağacı (ilk 20 satır)'));
      assert.ok(ctx.includes('docs/journal/README.md'));
    } finally {
      sh(repo, 'checkout', '--', 'docs/journal/README.md');
    }
  });

  test('says so when there is no origin (local-first)', () => {
    assert.ok(runContext(repo, { agentDir }).includes('origin tanımlı değil'));
  });

  test('works when GitHub is unreachable', () => {
    assert.ok(runContext(repo, { agentDir }).includes("(GitHub'a ulaşılamadı"));
  });

  test('reports an unreachable origin without failing', () => {
    sh(repo, 'remote', 'add', 'origin', path.join(root, 'does-not-exist.git'));
    try {
      const ctx = runContext(repo, { agentDir });
      assert.ok(ctx.includes('## Git durumu'));
      assert.ok(ctx.includes("origin'e ulaşılamadı"));
    } finally {
      sh(repo, 'remote', 'remove', 'origin');
    }
  });

  test('lists local branches that are not on their upstream or have none, and not pushed ones', () => {
    const dir = makeRepo('branches');
    const remote = path.join(root, 'branches-remote.git');
    sh(root, 'init', '-q', '--bare', '-b', 'main', remote);
    sh(dir, 'remote', 'add', 'origin', remote);
    sh(dir, 'push', '-q', '-u', 'origin', 'main');
    sh(dir, 'switch', '-q', '-c', 'feat/pushed');
    sh(dir, 'commit', '-q', '--allow-empty', '-m', 'chore: pushed');
    sh(dir, 'push', '-q', '-u', 'origin', 'feat/pushed');
    sh(dir, 'commit', '-q', '--allow-empty', '-m', 'chore: ahead by one');
    sh(dir, 'switch', '-q', '-c', 'feat/local-only');
    sh(dir, 'commit', '-q', '--allow-empty', '-m', 'chore: local one');
    sh(dir, 'commit', '-q', '--allow-empty', '-m', 'chore: local two');
    sh(dir, 'switch', '-q', '-c', 'feat/empty', 'main');
    const agent = path.join(dir, '.agentcfg');
    mkdirSync(agent, { recursive: true });
    writeFileSync(path.join(agent, 'handoff.md'), '# Devir notu\n');
    const ctx = runContext(dir, { agentDir: agent });
    assert.ok(ctx.includes("## Upstream'inde olmayan commit'li yerel dallar"), ctx);
    assert.ok(ctx.includes('- feat/pushed: 1 commit origin/feat/pushed dalında yok'));
    assert.ok(ctx.includes('- feat/local-only: 3 commit hiçbir uzak dalda yok'));
    assert.ok(!ctx.includes('- feat/empty:'));
    assert.ok(!ctx.includes('- main:'));
  });

  test('without any remote, every local branch is listed as having no upstream', () => {
    const dir = makeRepo('no-remote');
    sh(dir, 'switch', '-q', '-c', 'ci/bootstrap');
    const agent = path.join(dir, '.agentcfg');
    mkdirSync(agent, { recursive: true });
    writeFileSync(path.join(agent, 'handoff.md'), '# Devir notu\n');
    const ctx = runContext(dir, { agentDir: agent });
    assert.ok(ctx.includes('- ci/bootstrap: upstream yok (uzak repo tanımlı değil)'));
  });

  test('lists ADR titles only when the folder exists', () => {
    assert.ok(!runContext(repo, { agentDir }).includes('## Kararlar (ADR)'));
    const dir = makeRepo('adr');
    write(dir, 'docs/adr/0001-demo.md', '# ADR-0001 — Demo Karar\n');
    const agent = path.join(dir, '.agentcfg');
    mkdirSync(agent, { recursive: true });
    writeFileSync(path.join(agent, 'handoff.md'), '# Devir notu\n');
    const ctx = runContext(dir, { agentDir: agent });
    assert.ok(ctx.includes('## Kararlar (ADR)\nADR-0001 — Demo Karar'));
  });

  test('the doctor is optional: absent means no section, a broken one a short note, a good one a summary', () => {
    const dir = makeRepo('doctor');
    const agent = path.join(dir, '.agentcfg');
    mkdirSync(agent, { recursive: true });
    writeFileSync(path.join(agent, 'handoff.md'), '# Devir notu\n');
    assert.ok(!runContext(dir, { agentDir: agent }).includes('Ortam kontrolü'));

    write(dir, 'tooling/scripts/doctor.mjs', 'process.exit(3);\n');
    assert.ok(runContext(dir, { agentDir: agent }).includes('doctor çalıştırılamadı'));

    write(
      dir,
      'tooling/scripts/doctor.mjs',
      `console.log(JSON.stringify([{name:'hooks',level:'error',detail:'unset'},{name:'gh',level:'warn',detail:'no login'},{name:'node',level:'ok'}])); process.exit(1);\n`,
    );
    const ctx = runContext(dir, { agentDir: agent });
    assert.ok(ctx.includes('## Ortam kontrolü'));
    assert.ok(ctx.includes('- [HATA] hooks: unset'));
    assert.ok(ctx.includes('- [uyarı] gh: no login'));
    assert.ok(!ctx.includes('node:'));

    write(dir, 'tooling/scripts/doctor.mjs', `console.log(JSON.stringify([{name:'node',level:'ok'}]));\n`);
    assert.ok(!runContext(dir, { agentDir: agent }).includes('Ortam kontrolü'));
  });

  test('the whole output is bounded', () => {
    const dir = makeRepo('big');
    const agent = path.join(dir, '.agentcfg');
    mkdirSync(agent, { recursive: true });
    writeFileSync(path.join(agent, 'handoff.md'), `${'x'.repeat(100)}\n`.repeat(100));
    write(dir, 'docs/roadmap.md', `## Mevcut durum\n${'y'.repeat(200)}\n`.repeat(200));
    const ctx = runContext(dir, { agentDir: agent });
    assert.ok(ctx.length < 25000, String(ctx.length));
    assert.ok(ctx.includes('bağlam kısaltıldı'));
  });

  test('writes the session start epoch and prunes old state files', () => {
    const stateDir = path.join(agentDir, 'state');
    mkdirSync(stateDir, { recursive: true });
    const old = path.join(stateDir, 'session-old.start');
    writeFileSync(old, '1\n');
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
    utimesSync(old, eightDaysAgo, eightDaysAgo);
    const before = Math.floor(Date.now() / 1000);
    runContext(repo, { agentDir, stdin: '{"session_id":"sess-42"}' });
    const file = path.join(stateDir, 'session-sess-42.start');
    assert.ok(existsSync(file));
    const epoch = Number(readFileSync(file, 'utf8').trim());
    assert.ok(epoch >= before && epoch <= before + 60, `unexpected epoch ${epoch}`);
    assert.ok(!existsSync(old), 'old state file must be pruned');
  });

  test('falls back to session id "unknown" for missing or broken stdin', () => {
    runContext(repo, { agentDir, stdin: 'not json' });
    assert.ok(existsSync(path.join(agentDir, 'state', 'session-unknown.start')));
    runContext(repo, { agentDir, stdin: '' });
  });

  test('warns loudly when the agent folder is not git-ignored', () => {
    const open = path.join(repo, '.notignored');
    mkdirSync(open, { recursive: true });
    writeFileSync(path.join(open, 'handoff.md'), '# Devir notu\n');
    const ctx = runContext(repo, { agentDir: open });
    assert.ok(ctx.startsWith('## UYARI'));
    assert.ok(ctx.includes('.git/info/exclude'));
    assert.ok(ctx.includes('.notignored/'));
  });

  test('compares the agent folder to the repository through symlinks and short names', (t) => {
    // Windows temp dirs can use 8.3 short names: the same folder can be spelled differently by git and by the caller.
    const link = path.join(root, 'repo-link');
    try {
      symlinkSync(repo, link, 'junction');
    } catch {
      t.skip('symlinks are not permitted here');
      return;
    }
    const open = path.join(repo, '.viasymlink');
    mkdirSync(open, { recursive: true });
    writeFileSync(path.join(open, 'handoff.md'), '# Devir notu\n');
    const ctx = runContext(repo, { agentDir: path.join(link, '.viasymlink') });
    assert.ok(ctx.startsWith('## UYARI'), ctx.slice(0, 300));
    assert.ok(ctx.includes('.viasymlink/'));
  });

  test('does not warn about an ignored agent folder', () => {
    assert.ok(!runContext(repo, { agentDir }).includes('.git/info/exclude'));
  });

  test('warns when the hand-off note is missing', () => {
    const empty = path.join(repo, '.agentcfg', 'empty');
    mkdirSync(empty, { recursive: true });
    const ctx = runContext(repo, { agentDir: empty });
    assert.ok(ctx.includes('Devir notu yok'));
    assert.ok(!ctx.includes('## Devir notu (güncelleme'));
  });

  test('still emits valid output without --agent-dir', () => {
    const ctx = runContext(repo, { args: [] });
    assert.ok(ctx.includes('--agent-dir verilmedi'));
    assert.ok(ctx.includes('## Git durumu'));
  });

  test('still emits valid output outside a repository', () => {
    const bare = path.join(root, 'not-a-repo');
    mkdirSync(bare, { recursive: true });
    const agent = path.join(bare, 'agent');
    mkdirSync(agent, { recursive: true });
    writeFileSync(path.join(agent, 'handoff.md'), '# Devir notu\n\nkaldığımız yer\n');
    const ctx = runContext(bare, { agentDir: agent });
    assert.equal(typeof ctx, 'string');
    assert.ok(ctx.includes('kaldığımız yer'));
  });

  test('reports a main that is behind origin/main', () => {
    const remote = path.join(root, 'remote.git');
    sh(root, 'init', '-q', '--bare', '-b', 'main', remote);
    sh(repo, 'remote', 'add', 'origin', remote);
    sh(repo, 'push', '-q', 'origin', 'main');
    const other = path.join(root, 'clone');
    sh(root, 'clone', '-q', remote, other);
    sh(other, 'config', 'user.name', 'tester');
    sh(other, 'config', 'user.email', 'tester@example.com');
    sh(other, 'config', 'commit.gpgsign', 'false');
    sh(other, 'commit', '-q', '--allow-empty', '-m', 'chore: from elsewhere');
    sh(other, 'push', '-q', 'origin', 'main');
    try {
      const ctx = runContext(repo, { agentDir });
      assert.ok(ctx.includes("origin/main'e göre: 0 ileride / 1 geride"));
      assert.ok(ctx.includes('git pull --ff-only'));
    } finally {
      sh(repo, 'remote', 'remove', 'origin');
    }
  });

  test('state directory contains only session files after runs', () => {
    assert.ok(readdirSync(path.join(agentDir, 'state')).every((f) => /^session-.*\.start$/.test(f)));
  });
});
