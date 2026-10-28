#!/usr/bin/env node
// Stop hook for AI coding agents. Fires at the end of every assistant turn and blocks finishing when the work
// record is incomplete, so nothing lives only on this device:
//   1. stale hand-off note: new commits or uncommitted changes to tracked files since the session started;
//   2. a local branch has commits that are not pushed, or has no upstream. During the local-first setup phase this
//      is allowed ONLY when the hand-off note is newer than the newest commit or tracked change AND names every
//      such branch; otherwise push, or update the note;
//   3. a commit was made today but today's journal summary ("Yapılanlar" / "Yarım kalan / sıradaki") is missing or empty.
// All problems are reported together in one Turkish reason. Portable: Node only (no jq, stat).
//
//   node tooling/scripts/agent-handoff-guard.ts --agent-dir <path>
//
// <path> is the local (git-ignored) agent folder holding `handoff.md` and `state/session-<id>.start`
// (written by agent-session-context.ts). Reads {session_id, stop_hook_active} as JSON on stdin.
// A reminder must never trap the session: on any internal error it prints a note to stderr and exits 0, and a
// failure while evaluating one rule never hides the others. `stop_hook_active` prevents block loops.
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, fstatSync, openSync, readFileSync, realpathSync, statSync, writeSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve symlinks and Windows 8.3 short names so that paths from git and from the caller compare equal.
function canonical(p: string): string {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

function git(args: string[], cwd: string, { raw = false }: { raw?: boolean } = {}): { ok: boolean; out: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 15000, windowsHide: true });
  return { ok: !r.error && r.status === 0, out: raw ? (r.stdout ?? '') : (r.stdout ?? '').trim() };
}

/** The Turkish block reason shown to the agent. `rel` is the agent folder relative to the repository. */
export function blockReason(rel: string): string {
  return `Bu oturumda yeni commit ve/veya commit edilmemiş değişiklik var ama ${rel}/handoff.md güncellenmedi (son güncelleme bu oturumun başlangıcından veya son commit'ten eski). Bitirmeden önce ${rel}/handoff.md dosyasını güncelle: # Devir notu, Tarih/saat, ## Ne yapılıyordu, ## Durum, ## Bekleyen soru/onay, ## Sıradaki adım (en fazla ~40 satır). Bu dosyayı commit'leme.`;
}

/**
 * Decision core of the hand-off rule. All times are unix epoch seconds.
 * start: session start, handoff: handoff.md mtime (0 if missing), newestCommit: newest committer date on any branch,
 * dirty: tracked changes exist.
 */
export function shouldBlock({
  start,
  handoff,
  newestCommit,
  dirty,
}: {
  start: number;
  handoff: number;
  newestCommit: number;
  dirty: boolean;
}): boolean {
  const newerCommit = newestCommit > start;
  if (!(newerCommit || dirty)) return false;
  return handoff < Math.max(newestCommit, start);
}

/** True when `text` mentions the branch `name` as a whole token (feat/x must not match feat/xy or feat/x/y). */
export function namesBranch(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9._/-])${escaped}(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9])`).test(text);
}

/**
 * Decision for unpushed branches. branches: [{name, count, upstream}], times in epoch seconds, handoffText the note.
 * Returns null (nothing to say, or covered by a fresh note that names every branch) or the Turkish problem text.
 * `rel` is the agent folder relative to the repository.
 */
export type UnpushedBranch = { name: string; count: number; upstream: string };

export function unpushedDecision({
  branches,
  handoff,
  newestChange,
  handoffText,
  rel,
}: {
  branches: UnpushedBranch[];
  handoff: number;
  newestChange: number;
  handoffText: string | null | undefined;
  rel: string;
}): string | null {
  if (!branches.length) return null;
  const stale = handoff < newestChange;
  const unnamed = branches.filter((b) => !namesBranch(handoffText ?? '', b.name));
  if (!stale && !unnamed.length) return null;
  const lines = branches.map(
    (b) =>
      `- "${b.name}": ${b.count} commit ${b.upstream ? `${b.upstream} dalında yok` : 'hiçbir uzak dalda yok (upstream tanımlı değil)'}`,
  );
  const todo: string[] = [];
  if (stale) todo.push(`${rel}/handoff.md son commit ve değişiklikten eski; dosyayı bunlardan SONRA güncelle`);
  if (unnamed.length)
    todo.push(`${rel}/handoff.md şu dalların adını içermiyor: ${unnamed.map((b) => b.name).join(', ')}`);
  return `Push edilmemiş commit'ler var, iş sadece bu cihazda duruyor:\n${lines.join('\n')}\nYa push et (git push -u origin <dal>) ya da (yerel kurulum aşamasında) devir notunu güncelleyip her dalın adını içinde an. Eksik: ${todo.join('; ')}.`;
}

/** Turkish problem text for a missing or empty journal summary. `file` is the journal path relative to the root. */
export function journalReason(file: string, problem: string): string {
  return `Bugün commit yapıldı ama bugünün günlüğünün özeti eksik (${file}: ${problem}). Günün Özet bölümünü güncelle (main'e doğrudan yazılmaz; ilgili dalda):"### Yapılanlar" ve "### Yarım kalan / sıradaki" altında en az birer madde olmalı (kısa, Türkçe); böylece repo düzeyindeki devir notu güncel kalır.`;
}

/** Non-blank lines under the `### <title>` subsection of a journal file (up to the next heading). */
export function subsectionLines(text: string, title: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let on = false;
  for (const line of lines) {
    if (line.startsWith('### ') || line.startsWith('## ') || line.startsWith('# ')) {
      on = line.trim() === `### ${title}`;
      continue;
    }
    if (on && line.trim() !== '') out.push(line);
  }
  return out;
}

/** Problem text when the journal summary is incomplete, or null. `text` is null when the file is missing. */
export function journalProblem(file: string, text: string | null): string | null {
  if (text === null) return 'dosya yok';
  const missing = ['Yapılanlar', 'Yarım kalan / sıradaki'].filter((t) => subsectionLines(text, t).length === 0);
  return missing.length ? `boş veya eksik bölüm: ${missing.map((t) => `"${t}"`).join(', ')}` : null;
}

/** The reason to show: the single problem as is, or a numbered list of all of them. */
export function combineReasons(problems: string[]): string {
  if (problems.length === 1) return problems[0];
  return `Oturumu bitirmeden önce şu sorunları gider (hepsi):\n${problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local date as YYYY-MM-DD. */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------- rules

type HookInput = { session_id?: unknown; stop_hook_active?: unknown };

function staleHandoffProblem(root: string, agentDir: string, input: HookInput): string | null {
  const sessionId = typeof input.session_id === 'string' ? input.session_id : '';
  if (!sessionId) return null;

  let start: number;
  try {
    const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, '_');
    const text = readFileSync(path.join(agentDir, 'state', `session-${safe}.start`), 'utf8').trim();
    if (!/^[0-9]+$/.test(text)) return null;
    start = Number(text);
  } catch {
    return null;
  }

  let handoff = 0;
  try {
    handoff = Math.floor(statSync(path.join(agentDir, 'handoff.md')).mtimeMs / 1000);
  } catch {
    handoff = 0;
  }

  const newest = git(
    ['for-each-ref', '--sort=-committerdate', 'refs/heads', '--format=%(committerdate:unix)'],
    root,
  ).out.split(/\r?\n/)[0];
  const newestCommit = /^[0-9]+$/.test(newest ?? '') ? Number(newest) : 0;
  const dirty = git(['status', '--porcelain'], root)
    .out.split(/\r?\n/)
    .some((l) => l && !l.startsWith('??'));

  if (!shouldBlock({ start, handoff, newestCommit, dirty })) return null;
  return blockReason(agentRel(root, agentDir));
}

/** Local branches (other than main) whose commits are not on their upstream, or on any remote when they have none. */
export function unpushedBranches(root: string): UnpushedBranch[] {
  if (!git(['for-each-ref', '--count=1', 'refs/remotes'], root).out) return []; // no remote to push to: nothing to say
  const rows = git(['for-each-ref', '--format=%(refname:short)%09%(upstream:short)', 'refs/heads'], root)
    .out.split(/\r?\n/)
    .filter(Boolean);
  const out: UnpushedBranch[] = [];
  for (const row of rows) {
    const [name, upstream = ''] = row.split('\t');
    if (name === 'main') continue;
    let r = upstream ? git(['rev-list', '--count', `${upstream}..${name}`], root) : { ok: false, out: '' };
    let label = upstream;
    if (!r.ok) {
      // No (or a vanished) upstream: a commit counts as pushed if ANY remote branch contains it.
      r = git(['rev-list', '--count', name, '--not', '--remotes'], root);
      label = '';
    }
    const n = r.ok ? Number(r.out) : 0;
    if (n > 0) out.push({ name, count: n, upstream: label });
  }
  return out;
}

/** Newest committer date on any local branch and newest mtime of a changed tracked file, in epoch seconds. */
function newestChangeTime(root: string): number {
  const newest = git(
    ['for-each-ref', '--sort=-committerdate', 'refs/heads', '--format=%(committerdate:unix)'],
    root,
  ).out.split(/\r?\n/)[0];
  let t = /^[0-9]+$/.test(newest ?? '') ? Number(newest) : 0;
  // -z keeps unusual file names unquoted; git() trims only the ends, so NUL separators survive.
  const entries = git(['status', '--porcelain', '-z'], root, { raw: true }).out.split('\0').filter(Boolean);
  for (let k = 0; k < entries.length; k++) {
    const status = entries[k].slice(0, 2);
    if (status[0] === 'R' || status[0] === 'C') k++; // the next entry is the original path
    if (status === '??') continue;
    try {
      t = Math.max(t, Math.floor(statSync(path.join(root, entries[k].slice(3))).mtimeMs / 1000));
    } catch {
      /* deleted file: no mtime */
    }
  }
  return t;
}

function agentRel(root: string, agentDir: string): string {
  const rel = path.relative(canonical(root), canonical(agentDir)).replace(/\\/g, '/') || '.';
  return rel.startsWith('..') || path.isAbsolute(rel) ? agentDir.replace(/\\/g, '/') : rel;
}

function unpushedProblem(root: string, agentDir: string): string | null {
  const branches = unpushedBranches(root);
  if (!branches.length) return null;
  const file = path.join(agentDir, 'handoff.md');
  let handoff = 0;
  let handoffText = '';
  try {
    // One descriptor for both reads: no window between checking the file and using it.
    const fd = openSync(file, 'r');
    try {
      handoff = Math.floor(fstatSync(fd).mtimeMs / 1000);
      handoffText = readFileSync(fd, 'utf8');
    } finally {
      closeSync(fd);
    }
  } catch {
    /* a missing note counts as stale and naming nothing */
  }
  return unpushedDecision({
    branches,
    handoff,
    newestChange: newestChangeTime(root),
    handoffText,
    rel: agentRel(root, agentDir),
  });
}

function journalSummaryProblem(root: string): string | null {
  const email = git(['config', 'user.email'], root).out;
  const now = new Date();
  const since = `${localDate(now)} 00:00:00`;
  const rel = `docs/journal/${localDate(now)}.md`;
  const README = 'docs/journal/README.md';
  const hasToday = (ref: string): boolean => {
    const args = ['log', ref, '--no-merges', `--since=${since}`, '-1', '--format=%H'];
    if (email) args.push(`--author=${email}`);
    const r = git(args, root);
    return r.ok && r.out !== '';
  };

  // Candidate refs: every local branch plus detached worktree HEADs. Each one that holds a commit of ours today
  // must carry the summary at its own tip (the journal rule is per commit/PR; main cannot be written directly,
  // so today's work normally lives on a branch). A ref whose tree has no docs/journal/README.md predates the
  // journal, so the rule does not apply to it. The checked-out branch of this worktree is judged by the file
  // on disk (uncommitted edits count); every other ref is read with `git show <ref>:<path>`.
  const current = git(['symbolic-ref', '--short', 'HEAD'], root);
  const currentLabel = current.ok && current.out ? current.out : 'HEAD';
  const refs = new Map<string, string>(); // ref -> label
  for (const b of git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], root).out.split(/\r?\n/)) {
    if (b) refs.set(b, `"${b}" dalı`);
  }
  let wtPath = '';
  for (const line of git(['worktree', 'list', '--porcelain'], root).out.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) wtPath = line.slice(9);
    else if (line.startsWith('HEAD ') && line.slice(5).trim() && !refs.has(line.slice(5).trim())) {
      refs.set(line.slice(5).trim(), `${wtPath} çalışma ağacının HEAD'i`);
    }
  }
  if (!current.ok) refs.set('HEAD', 'HEAD (detached)');

  const problems: string[] = [];
  for (const [ref, label] of refs) {
    if (!hasToday(ref)) continue;
    let text: string | null = null;
    if (ref === currentLabel) {
      if (!existsSync(path.join(root, README))) continue;
      try {
        text = readFileSync(path.join(root, rel), 'utf8');
      } catch {
        text = null;
      }
    } else {
      if (!git(['cat-file', '-e', `${ref}:${README}`], root).ok) continue;
      const shown = git(['show', `${ref}:${rel}`], root);
      text = shown.ok ? shown.out : null;
    }
    const problem = journalProblem(rel, text);
    if (problem) problems.push(journalReason(`${label}: ${rel}`, problem));
  }
  return problems.length ? problems.join('\n') : null;
}

function main(): void {
  const argv = process.argv.slice(2);
  const i = argv.indexOf('--agent-dir');
  if (i === -1 || !argv[i + 1]) throw new Error('--agent-dir <path> is required');
  const agentDir = path.resolve(process.cwd(), argv[i + 1]);

  let input: HookInput = {};
  try {
    const raw = readFileSync(0, 'utf8');
    input = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return; // nothing to judge without the hook input
  }
  if (input.stop_hook_active === true) return;

  const top = git(['rev-parse', '--show-toplevel'], process.cwd());
  const root = top.ok && top.out ? top.out : process.cwd();

  const problems: string[] = [];
  const rules: (() => string | null)[] = [
    () => staleHandoffProblem(root, agentDir, input),
    () => unpushedProblem(root, agentDir),
    () => journalSummaryProblem(root),
  ];
  for (const rule of rules) {
    try {
      const p = rule();
      if (p) problems.push(p);
    } catch (e) {
      process.stderr.write(`agent-handoff-guard: ${e instanceof Error ? e.message : String(e)} (rule skipped)\n`);
    }
  }
  if (problems.length) writeSync(1, `${JSON.stringify({ decision: 'block', reason: combineReasons(problems) })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (e) {
    process.stderr.write(`agent-handoff-guard: ${e instanceof Error ? e.message : String(e)} (not blocking)\n`);
  }
  process.exitCode = 0;
}
