// Tests for agent-handoff-guard.mjs. Real temporary git repositories; nothing is mocked.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  blockReason,
  combineReasons,
  journalProblem,
  localDate,
  namesBranch,
  shouldBlock,
  unpushedDecision,
  subsectionLines,
} from './agent-handoff-guard.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-handoff-guard.mjs');
const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'handoff-test-'));
let counter = 0;

function sh(cwd, env, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(r.status, 0, `git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.trim();
}

const NOW = Math.floor(Date.now() / 1000);
const TODAY = localDate();
const FULL_JOURNAL = `# ${TODAY}

## Özet

### Yapılanlar
- bir şey yapıldı

### Yarım kalan / sıradaki
- sıradaki iş

## Commit günlüğü
`;

function writeJournal(repo, text) {
  const file = path.join(repo, 'docs', 'journal', `${TODAY}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
}

// Fresh repository with an ignored agent folder; one commit dated `commitAt`.
function setup({ commitAt = NOW - 1000, readme = true } = {}) {
  const repo = path.join(root, `r${counter++}`);
  mkdirSync(repo, { recursive: true });
  const date = { GIT_COMMITTER_DATE: `${commitAt} +0000`, GIT_AUTHOR_DATE: `${commitAt} +0000` };
  sh(repo, {}, 'init', '-q', '-b', 'main');
  sh(repo, {}, 'config', 'user.name', 'tester');
  sh(repo, {}, 'config', 'user.email', 'tester@example.com');
  writeFileSync(path.join(repo, 'tracked.txt'), 'one\n');
  writeJournal(repo, FULL_JOURNAL);
  if (readme) writeFileSync(path.join(repo, 'docs', 'journal', 'README.md'), '# Günlük');
  appendFileSync(path.join(repo, '.git', 'info', 'exclude'), '.agentcfg/\n');
  sh(repo, {}, 'add', 'tracked.txt', 'docs');
  sh(repo, date, 'commit', '-q', '-m', 'chore: init');
  const agentDir = path.join(repo, '.agentcfg');
  mkdirSync(path.join(agentDir, 'state'), { recursive: true });
  return { repo, agentDir, date };
}

function setStart(agentDir, sessionId, epoch) {
  writeFileSync(path.join(agentDir, 'state', `session-${sessionId}.start`), `${epoch}\n`);
}

function setHandoff(agentDir, epoch, text = '# Devir notu\n') {
  const file = path.join(agentDir, 'handoff.md');
  writeFileSync(file, text);
  utimesSync(file, epoch, epoch);
}

function run(repo, agentDir, input, args) {
  const r = spawnSync('node', [SCRIPT, ...(args ?? ['--agent-dir', agentDir])], {
    cwd: repo,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, 'the hook must always exit 0');
  return { blocked: r.stdout.trim() !== '', out: r.stdout.trim() ? JSON.parse(r.stdout) : null, stderr: r.stderr };
}

after(() => rmSync(root, { recursive: true, force: true }));

describe('decision core', () => {
  test('nothing new: never blocks', () => {
    assert.equal(shouldBlock({ start: 100, handoff: 0, newestCommit: 50, dirty: false }), false);
  });
  test('new commit and stale note: blocks', () => {
    assert.equal(shouldBlock({ start: 100, handoff: 90, newestCommit: 150, dirty: false }), true);
  });
  test('new commit but note updated after it: allows', () => {
    assert.equal(shouldBlock({ start: 100, handoff: 150, newestCommit: 150, dirty: false }), false);
  });
  test('dirty tree and note older than session start: blocks', () => {
    assert.equal(shouldBlock({ start: 100, handoff: 99, newestCommit: 50, dirty: true }), true);
  });
  test('dirty tree and note newer than session start: allows', () => {
    assert.equal(shouldBlock({ start: 100, handoff: 120, newestCommit: 50, dirty: true }), false);
  });
  test('missing note (0) with changes: blocks', () => {
    assert.equal(shouldBlock({ start: 100, handoff: 0, newestCommit: 50, dirty: true }), true);
  });
  test('the reason is the Turkish instruction with the relative path', () => {
    const r = blockReason('.agentcfg');
    assert.ok(
      r.startsWith(
        'Bu oturumda yeni commit ve/veya commit edilmemiş değişiklik var ama .agentcfg/handoff.md güncellenmedi',
      ),
    );
    assert.ok(
      r.includes(
        "Bitirmeden önce .agentcfg/handoff.md dosyasını güncelle: # Devir notu, Tarih/saat, ## Ne yapılıyordu, ## Durum, ## Bekleyen soru/onay, ## Sıradaki adım (en fazla ~40 satır). Bu dosyayı commit'leme.",
      ),
    );
  });
});

describe('hook behaviour', () => {
  let ctx;
  beforeEach(() => {
    ctx = setup();
  });

  test('clean repository, no new commits: allows', () => {
    setStart(ctx.agentDir, 's1', NOW);
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('new commit after session start with a stale note: blocks with the decision JSON', () => {
    setStart(ctx.agentDir, 's1', NOW - 500);
    setHandoff(ctx.agentDir, NOW - 800);
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'two\n');
    sh(ctx.repo, {}, 'commit', '-q', '-am', 'chore: change');
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.equal(r.out.decision, 'block');
    assert.ok(r.out.reason.includes('.agentcfg/handoff.md güncellenmedi'));
  });

  test('new commit but the note was updated afterwards: allows', () => {
    setStart(ctx.agentDir, 's1', NOW - 500);
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'two\n');
    sh(ctx.repo, {}, 'commit', '-q', '-am', 'chore: change');
    setHandoff(ctx.agentDir, NOW + 600);
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('uncommitted change to a tracked file with a stale note: blocks', () => {
    setStart(ctx.agentDir, 's1', NOW);
    setHandoff(ctx.agentDir, NOW - 100);
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'dirty\n');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, true);
  });

  test('uncommitted change and no note at all: blocks', () => {
    setStart(ctx.agentDir, 's1', NOW);
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'dirty\n');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, true);
  });

  test('untracked files alone do not count as changes', () => {
    setStart(ctx.agentDir, 's1', NOW);
    writeFileSync(path.join(ctx.repo, 'new-file.txt'), 'x\n');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('stop_hook_active short-circuits', () => {
    setStart(ctx.agentDir, 's1', NOW);
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'dirty\n');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1', stop_hook_active: true }).blocked, false);
  });

  test('missing session id, missing or invalid start file: allows', () => {
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'dirty\n');
    assert.equal(run(ctx.repo, ctx.agentDir, {}).blocked, false);
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 'nope' }).blocked, false);
    writeFileSync(path.join(ctx.agentDir, 'state', 'session-bad.start'), 'abc\n');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 'bad' }).blocked, false);
  });

  test('broken stdin: allows without error', () => {
    assert.equal(run(ctx.repo, ctx.agentDir, 'not json').blocked, false);
    assert.equal(run(ctx.repo, ctx.agentDir, '').blocked, false);
  });

  test('internal error (no --agent-dir): exits 0 with a stderr note, never blocks', () => {
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' }, []);
    assert.equal(r.blocked, false);
    assert.match(r.stderr, /agent-handoff-guard: .*--agent-dir/);
  });

  test('works from a subdirectory of the repository', () => {
    setStart(ctx.agentDir, 's1', NOW);
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'dirty\n');
    mkdirSync(path.join(ctx.repo, 'sub'), { recursive: true });
    const r = run(path.join(ctx.repo, 'sub'), ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('.agentcfg/handoff.md'), 'path is relative to the repository root');
  });
});

describe('journal and push helpers', () => {
  test('subsection lines ignore blank lines and stop at the next heading', () => {
    const text = '## Özet\n\n### Yapılanlar\n\n- a\n\n- b\n### Kararlar\n- c\n';
    assert.deepEqual(subsectionLines(text, 'Yapılanlar'), ['- a', '- b']);
    assert.deepEqual(subsectionLines(text, 'Kararlar'), ['- c']);
    assert.deepEqual(subsectionLines(text, 'Yok'), []);
  });
  test('journal problem: missing file, empty sections, fine', () => {
    assert.equal(journalProblem('x.md', null), 'dosya yok');
    assert.match(journalProblem('x.md', '### Yapılanlar\n\n### Yarım kalan / sıradaki\n- x\n'), /"Yapılanlar"/);
    assert.match(
      journalProblem('x.md', '### Yapılanlar\n- x\n### Yarım kalan / sıradaki\n\n## Commit günlüğü\n'),
      /"Yarım kalan \/ sıradaki"/,
    );
    assert.match(journalProblem('x.md', '## Özet\n'), /"Yapılanlar", "Yarım kalan \/ sıradaki"/);
    assert.equal(journalProblem('x.md', FULL_JOURNAL), null);
  });
  test('one problem is shown as is, several as a numbered list', () => {
    assert.equal(combineReasons(['a']), 'a');
    const many = combineReasons(['a', 'b']);
    assert.match(many, /^Oturumu bitirmeden önce şu sorunları gider/);
    assert.ok(many.includes('1. a\n2. b'));
  });
});

describe('unpushed branches rule', () => {
  let ctx;
  beforeEach(() => {
    ctx = setup();
    const bare = path.join(root, `bare${counter++}.git`);
    sh(root, {}, 'init', '-q', '--bare', '-b', 'main', bare);
    sh(ctx.repo, {}, 'remote', 'add', 'origin', bare);
    sh(ctx.repo, {}, 'push', '-q', 'origin', 'main');
    ctx.bare = bare;
  });

  test('a feature branch without upstream, stale note: blocks and names what to fix', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"feat/x": 1 commit hiçbir uzak dalda yok'));
    assert.ok(r.out.reason.includes('git push -u origin <dal>'));
    assert.ok(r.out.reason.includes('.agentcfg/handoff.md şu dalların adını içermiyor: feat/x'));
    assert.ok(r.out.reason.includes('.agentcfg/handoff.md son commit ve değişiklikten eski'));
  });

  test('ALLOWED: unpushed branch, note newer than the newest commit and naming the branch', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    setHandoff(ctx.agentDir, NOW + 60, '# Devir notu\n\nDal `feat/x` yerelde, push edilmedi.\n');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('BLOCKED: note is fresh but does not name the branch (a longer name does not count)', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    setHandoff(ctx.agentDir, NOW + 60, '# Devir notu\n\nDal feat/xyz ve feat/x/y üzerinde çalışıldı.\n');
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('adını içermiyor: feat/x'));
    assert.ok(!r.out.reason.includes('son commit ve değişiklikten eski'));
  });

  test('BLOCKED: note names the branch but is older than the newest commit', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    setHandoff(ctx.agentDir, NOW - 5000, '# Devir notu\n\nDal feat/x yerelde.\n');
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('son commit ve değişiklikten eski'));
    assert.ok(!r.out.reason.includes('adını içermiyor'));
  });

  test('BLOCKED: note is newer than the commits but older than a tracked change', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    setHandoff(ctx.agentDir, NOW + 60, '# Devir notu\n\nDal feat/x yerelde.\n');
    writeFileSync(path.join(ctx.repo, 'tracked.txt'), 'edited\n');
    utimesSync(path.join(ctx.repo, 'tracked.txt'), NOW + 600, NOW + 600);
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('son commit ve değişiklikten eski'));
  });

  test('untracked files do not make the note stale', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    setHandoff(ctx.agentDir, NOW + 60, '# Devir notu\n\nDal feat/x yerelde.\n');
    writeFileSync(path.join(ctx.repo, 'brand-new.txt'), 'x\n');
    utimesSync(path.join(ctx.repo, 'brand-new.txt'), NOW + 600, NOW + 600);
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('every unpushed branch must be named, not only the checked-out one', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/a');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: a');
    sh(ctx.repo, {}, 'switch', '-q', 'main');
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/b');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: b');
    setHandoff(ctx.agentDir, NOW + 60, '# Devir notu\n\nYalnız feat/b anıldı.\n');
    const blocked = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(blocked.blocked, true);
    assert.ok(blocked.out.reason.includes('adını içermiyor: feat/a'));
    assert.ok(!blocked.out.reason.includes('adını içermiyor: feat/a, feat/b'));
    setHandoff(ctx.agentDir, NOW + 60, '# Devir notu\n\nfeat/a ve feat/b yerelde.\n');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('unpushed branch and no note file at all: blocks as stale and naming nothing', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    rmSync(path.join(ctx.agentDir, 'handoff.md'), { force: true });
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('şu dalların adını içermiyor: feat/x'));
  });

  test('after pushing the branch: allows even without a note', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    sh(ctx.repo, {}, 'push', '-q', '-u', 'origin', 'feat/x');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('a branch with an upstream that is behind its local state: blocks with the count', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: one');
    sh(ctx.repo, {}, 'push', '-q', '-u', 'origin', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: two');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: three');
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"feat/x": 2 commit origin/feat/x dalında yok'));
  });

  test('no upstream but all commits are on another remote branch: allows', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/base');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: base one');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: base two');
    sh(ctx.repo, {}, 'push', '-q', '-u', 'origin', 'feat/base');
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/next');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('no upstream, stacked on a pushed branch with one local-only commit: blocks with count 1', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/base');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: base one');
    sh(ctx.repo, {}, 'push', '-q', '-u', 'origin', 'feat/base');
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/next');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: mine');
    const r = run(ctx.repo, ctx.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"feat/next": 1 commit hiçbir uzak dalda yok'));
  });

  test('a new branch without commits of its own: allows', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/empty');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('main is never judged by this rule', () => {
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: on main');
    assert.equal(run(ctx.repo, ctx.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('a repository without a remote has nothing to push to: allows', () => {
    const local = setup();
    sh(local.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(local.repo, local.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    assert.equal(run(local.repo, local.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('works without a session start file (the rule does not depend on it)', () => {
    sh(ctx.repo, {}, 'switch', '-q', '-c', 'feat/x');
    sh(ctx.repo, ctx.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    assert.equal(run(ctx.repo, ctx.agentDir, {}).blocked, true);
  });
});

describe('unpushed decision core', () => {
  const branches = [{ name: 'ci/bootstrap', count: 5, upstream: '' }];
  const base = { branches, handoff: 200, newestChange: 100, handoffText: 'dal ci/bootstrap yerelde', rel: '.agentcfg' };

  test('branch names match as whole tokens only', () => {
    assert.equal(namesBranch('dal feat/x, bitti', 'feat/x'), true);
    assert.equal(namesBranch('`feat/x`', 'feat/x'), true);
    assert.equal(namesBranch('feat/x.', 'feat/x'), true);
    assert.equal(namesBranch('feat/xy', 'feat/x'), false);
    assert.equal(namesBranch('feat/x/y', 'feat/x'), false);
    assert.equal(namesBranch('myfeat/x', 'feat/x'), false);
    assert.equal(namesBranch('feat+x', 'feat.x'), false);
  });
  test('nothing unpushed: null', () => assert.equal(unpushedDecision({ ...base, branches: [] }), null));
  test('fresh note naming every branch: null', () => assert.equal(unpushedDecision(base), null));
  test('note exactly as new as the change: null', () =>
    assert.equal(unpushedDecision({ ...base, handoff: 100 }), null));
  test('stale note: problem text', () =>
    assert.match(unpushedDecision({ ...base, handoff: 99 }), /eski; dosyayı bunlardan SONRA güncelle/));
  test('missing note: stale and unnamed', () => {
    const r = unpushedDecision({ ...base, handoff: 0, handoffText: '' });
    assert.match(r, /eski/);
    assert.match(r, /adını içermiyor: ci\/bootstrap/);
  });
});

describe('journal summary rule', () => {
  const fresh = () => setup({ commitAt: NOW - 5 }); // a commit made today

  test('commit today and no journal file for today: blocks', () => {
    const c = fresh();
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes(`docs/journal/${TODAY}.md`));
    assert.ok(r.out.reason.includes('dosya yok'));
    assert.ok(r.out.reason.includes('Günün Özet bölümünü güncelle'));
  });

  test('empty "Yapılanlar": blocks and names the section', () => {
    const c = fresh();
    writeJournal(c.repo, FULL_JOURNAL.replace('- bir şey yapıldı\n', ''));
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"Yapılanlar"'));
    assert.ok(!r.out.reason.includes('"Yarım kalan / sıradaki"'));
  });

  test('empty "Yarım kalan / sıradaki": blocks', () => {
    const c = fresh();
    writeJournal(c.repo, FULL_JOURNAL.replace('- sıradaki iş\n', ''));
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"Yarım kalan / sıradaki"'));
  });

  test('a complete summary: allows', () => {
    const c = fresh();
    assert.equal(run(c.repo, c.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('no commit today (all commits are old): allows even without a journal', () => {
    const c = setup({ commitAt: NOW - 3 * 86400 });
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    assert.equal(run(c.repo, c.agentDir, { session_id: 's1' }).blocked, false);
  });

  test("another author's commit today does not count", () => {
    const c = setup({ commitAt: NOW - 3 * 86400 });
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    sh(c.repo, {}, 'commit', '-q', '--allow-empty', '--author=Bot <bot@example.com>', '-m', 'ci: bump something');
    assert.equal(run(c.repo, c.agentDir, { session_id: 's1' }).blocked, false);
  });

  const today = { GIT_COMMITTER_DATE: `${NOW - 5} +0000`, GIT_AUTHOR_DATE: `${NOW - 5} +0000` };

  // Old main (no commit today) plus branch feat/other with a commit today; `journal` is committed on the branch
  // (null: the journal file is removed there). Ends on main.
  function branchOnly(journal) {
    const c = setup({ commitAt: NOW - 3 * 86400 });
    sh(c.repo, {}, 'switch', '-q', '-c', 'feat/other');
    if (journal === null) rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    else writeJournal(c.repo, journal);
    sh(c.repo, today, 'add', '-A');
    sh(c.repo, today, 'commit', '-q', '--allow-empty', '-m', 'chore: today');
    sh(c.repo, {}, 'switch', '-q', 'main');
    return c;
  }

  test('commit today only on a branch with a summary there; main disk has none: allows', () => {
    const c = branchOnly(FULL_JOURNAL);
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`)); // main on disk: no journal, branch tip has it
    assert.equal(run(c.repo, c.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('commit today on a branch without the summary: blocks and names the branch', () => {
    const c = branchOnly(null);
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"feat/other" dalı'));
    assert.ok(r.out.reason.includes(`docs/journal/${TODAY}.md`));
    assert.ok(r.out.reason.includes('dosya yok'));
  });

  test('commit today on a branch with an empty summary section: blocks', () => {
    const c = branchOnly(FULL_JOURNAL.replace('- sıradaki iş\n', ''));
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"feat/other" dalı'));
    assert.ok(r.out.reason.includes('"Yarım kalan / sıradaki"'));
  });

  test('commit today on main and no journal on disk: still blocks (main is judged by disk)', () => {
    const c = fresh();
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"main" dalı'));
  });
});

describe('journal summary rule: journal baseline', () => {
  test('a branch whose tree has no journal README (journal not started) is not reported', () => {
    const c = setup({ commitAt: NOW - 5, readme: false });
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    assert.equal(run(c.repo, c.agentDir, { session_id: 's1' }).blocked, false);
  });

  test('another ref without the README is skipped, the current one with it is still reported', () => {
    const c = setup({ commitAt: NOW - 5, readme: false });
    sh(c.repo, {}, 'switch', '-q', '-c', 'feat/late');
    writeFileSync(path.join(c.repo, 'docs', 'journal', 'README.md'), '# Günlük');
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    sh(c.repo, c.date, 'add', '-A');
    sh(c.repo, c.date, 'commit', '-q', '-m', 'docs: start journal');
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.ok(r.out.reason.includes('"feat/late" dalı'));
    assert.ok(!r.out.reason.includes('"main" dalı'));
  });
});

describe('combined reasons', () => {
  test('every problem is listed in one block reason', () => {
    const c = setup({ commitAt: NOW - 5 });
    const bare = path.join(root, `bare${counter++}.git`);
    sh(root, {}, 'init', '-q', '--bare', '-b', 'main', bare);
    sh(c.repo, {}, 'remote', 'add', 'origin', bare);
    sh(c.repo, {}, 'push', '-q', 'origin', 'main');
    sh(c.repo, {}, 'switch', '-q', '-c', 'feat/x');
    setStart(c.agentDir, 's1', NOW - 500);
    setHandoff(c.agentDir, NOW - 800);
    sh(c.repo, c.date, 'commit', '-q', '--allow-empty', '-m', 'chore: work');
    rmSync(path.join(c.repo, 'docs', 'journal', `${TODAY}.md`));
    const r = run(c.repo, c.agentDir, { session_id: 's1' });
    assert.equal(r.blocked, true);
    assert.match(r.out.reason, /^Oturumu bitirmeden önce şu sorunları gider/);
    assert.ok(r.out.reason.includes('1. Bu oturumda yeni commit'));
    assert.ok(r.out.reason.includes('2. Push edilmemiş commit'));
    assert.ok(r.out.reason.includes('"feat/x": 1 commit'));
    assert.ok(r.out.reason.includes('3. Bugün commit yapıldı'));
  });
});
