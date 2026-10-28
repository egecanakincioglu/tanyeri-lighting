#!/usr/bin/env node
// SessionStart hook for AI coding agents: loads the hand-off note, git and PR state, unpushed local branches,
// roadmap, last journal summary, plans, ADR titles and the doctor result, so a new session never needs
// the owner to re-explain where things stand. Portable: Node only (no jq, stat, date, timeout).
//
//   node tooling/scripts/agent-session-context.ts --agent-dir <path>
//
// <path> is the local (git-ignored) agent folder holding `handoff.md` and a `state/` directory.
// Reads {session_id} as JSON on stdin; prints {hookSpecificOutput:{hookEventName:"SessionStart",additionalContext}}.
// Never crashes: every section is wrapped, and output is always emitted.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const NET_TIMEOUT = 8000;
// The context is injected into every session, so each part and the whole are bounded.
const MAX_TOTAL_CHARS = 24000;
const MAX_HANDOFF_LINES = 150;
const MAX_LIST = 20;

// ---------------------------------------------------------------- helpers

type RunResult = { ok: boolean; out: string; status?: number };

function run(
  cmd: string,
  args: string[],
  { cwd, timeout = 15000 }: { cwd?: string; timeout?: number } = {},
): RunResult {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout, windowsHide: true });
  if (r.error || r.status === null) return { ok: false, out: '' };
  return { ok: r.status === 0, out: (r.stdout ?? '').replace(/\s+$/, ''), status: r.status };
}

// Resolve symlinks and Windows 8.3 short names so that paths from git and from the caller compare equal.
function canonical(p: string): string {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local time as YYYY-MM-DD HH:mm. */
export function formatLocal(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Lines of `text` between a heading line matching `startRe` and the next line matching `stopRe` (exclusive). */
export function sectionLines(text: string, startRe: RegExp, stopRe: RegExp): string[] {
  const out: string[] = [];
  let on = false;
  for (const line of text.split('\n')) {
    if (startRe.test(line)) {
      on = true;
      continue;
    }
    if (on && stopRe.test(line)) on = false;
    if (on) out.push(line);
  }
  return out;
}

const joinTrim = (lines: string[]): string => lines.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');

/** At most `max` items; the rest is replaced by a single "N more" line. */
export function capLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  return [...lines.slice(0, max), `... (+${lines.length - max} satır daha)`];
}

/** Open `- [ ]` roadmap items grouped by their `### ` heading (group heading printed once). */
export function openRoadmapItems(text: string): string[] {
  const out: string[] = [];
  let head = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('### ')) head = line;
    else if (line.startsWith('## ')) head = '';
    else if (/^- \[ \]/.test(line)) {
      if (head) {
        out.push(head);
        head = '';
      }
      out.push(line);
    }
  }
  return out;
}

const PASS = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);
const FAIL = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const PENDING = new Set(['PENDING', 'STALE']);

/** One line per open pull request with pass/fail/pending counts. */
export type OpenPr = {
  number: number;
  title: string;
  headRefName: string;
  statusCheckRollup?: { conclusion?: string | null }[] | null;
};

export function formatPrLines(prs: OpenPr[]): string[] {
  return prs.map((pr) => {
    const cs = (pr.statusCheckRollup ?? []).map((c) => c?.conclusion || 'PENDING');
    const count = (set: Set<string>) => cs.filter((c) => set.has(c)).length;
    return `#${pr.number} ${pr.title} [${pr.headRefName}] — checks: ${count(PASS)} pass / ${count(FAIL)} fail / ${count(PENDING)} pending`;
  });
}

const DOCTOR_FAIL = new Set(['error', 'fail', 'failed', 'failure']);
const DOCTOR_WARN = new Set(['warn', 'warning']);

/**
 * Failures and warnings out of a doctor `--json` result. The shape is read tolerantly: an array of checks, or an
 * object holding such an array (`checks`, `results`, `items`) and/or `failures` / `warnings` arrays.
 */
export type DoctorEntry = { level: 'fail' | 'warn'; name: string; detail: string };

// any: the doctor JSON is probed tolerantly with optional chaining, its shape is deliberately not fixed
export function summarizeDoctor(data: any): { failures: DoctorEntry[]; warnings: DoctorEntry[] } {
  const asItem = (x: any, level: 'fail' | 'warn'): DoctorEntry =>
    typeof x === 'string'
      ? { level, name: x, detail: '' }
      : { level, name: String(x?.name ?? x?.id ?? x?.check ?? '?'), detail: String(x?.detail ?? x?.message ?? '') };
  const failures: DoctorEntry[] = [];
  const warnings: DoctorEntry[] = [];
  const take = (list: any[]) => {
    for (const x of list) {
      const raw = typeof x === 'string' ? '' : String(x?.level ?? x?.status ?? x?.severity ?? '').toLowerCase();
      if (DOCTOR_FAIL.has(raw)) failures.push(asItem(x, 'fail'));
      else if (DOCTOR_WARN.has(raw)) warnings.push(asItem(x, 'warn'));
    }
  };
  if (Array.isArray(data)) take(data);
  else if (data && typeof data === 'object') {
    for (const key of ['checks', 'results', 'items']) if (Array.isArray(data[key])) take(data[key]);
    if (Array.isArray(data.failures)) failures.push(...data.failures.map((x: any) => asItem(x, 'fail')));
    if (Array.isArray(data.warnings)) warnings.push(...data.warnings.map((x: any) => asItem(x, 'warn')));
  }
  return { failures, warnings };
}

function parseArgs(argv: string[]): { agentDir: string | undefined } {
  const i = argv.indexOf('--agent-dir');
  return { agentDir: i !== -1 ? argv[i + 1] : undefined };
}

function listMd(dir: string, re: RegExp): string[] {
  try {
    return readdirSync(dir)
      .filter((f) => re.test(f))
      .sort()
      .map((f) => path.posix.join(dir.replace(/\\/g, '/'), f));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- sections

type Ctx = { root: string; agentDir: string; prs: OpenPr[] | null };

function section(name: string, fn: (ctx: Ctx) => string | undefined, ctx: Ctx): string {
  try {
    return fn(ctx) ?? '';
  } catch (e) {
    return `(${name} okunamadı: ${e instanceof Error ? e.message : String(e)})\n`;
  }
}

function handoffSection({ agentDir }: Ctx): string {
  const file = path.join(agentDir, 'handoff.md');
  if (!existsSync(file)) return '';
  const when = formatLocal(statSync(file).mtime);
  const lines = capLines((readText(file) ?? '').replace(/\n+$/, '').split('\n'), MAX_HANDOFF_LINES);
  return `## Devir notu (güncelleme: ${when})\n${lines.join('\n')}\n\n`;
}

function counts(root: string, a: string, b: string): { ahead: number; behind: number } | null {
  const r = run('git', ['rev-list', '--left-right', '--count', `${a}...${b}`], { cwd: root });
  if (!r.ok) return null;
  const [ahead, behind] = r.out.split(/\s+/).map(Number);
  return Number.isFinite(ahead) && Number.isFinite(behind) ? { ahead, behind } : null;
}

function gitStateSection({ root }: Ctx): string {
  const g = (...args: string[]) => run('git', args, { cwd: root });
  let out = '## Git durumu\n';
  const branch = g('symbolic-ref', '--short', 'HEAD').out;
  out += `- Dal: ${branch || '? (detached HEAD)'}\n`;
  const status = g('status', '--short').out.split('\n').filter(Boolean);
  if (status.length) out += `- Çalışma ağacı (ilk 20 satır):\n\`\`\`\n${status.slice(0, 20).join('\n')}\n\`\`\`\n`;
  else out += '- Çalışma ağacı temiz\n';
  const stash = g('stash', 'list').out.split('\n').filter(Boolean).length;
  if (stash > 0) out += `- Stash: ${stash}\n`;

  // Only talk to origin when there is one: the setup phase is local-first.
  const hasOrigin = g('remote', 'get-url', 'origin').ok;
  if (hasOrigin) {
    const fetched = run('git', ['fetch', '--quiet', '--prune', 'origin'], { cwd: root, timeout: NET_TIMEOUT }).ok;
    if (!fetched) out += "- (origin'e ulaşılamadı; durum son bilinen origin'e göre)\n";
    const m = g('rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main').ok
      ? counts(root, 'main', 'origin/main')
      : null;
    if (m) out += `- Yerel main, origin/main'e göre: ${m.ahead} ileride / ${m.behind} geride\n`;
    else out += '- (origin/main bulunamadı)\n';
    if (m && m.behind > 0 && branch === 'main')
      out += "- UYARI: main origin/main'in gerisinde; çalışmadan önce `git pull --ff-only`.\n";
    if (branch && branch !== 'main') {
      const up = g('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
      const c = up.ok ? counts(root, 'HEAD', '@{u}') : null;
      if (c) out += `- Dal ${branch}, ${up.out}'e göre: ${c.ahead} ileride / ${c.behind} geride\n`;
      else out += `- Dal ${branch}: upstream yok (henüz push edilmemiş)\n`;
    }
  } else {
    out += '- origin tanımlı değil (yerel çalışma); ileride/geride sayıları yok\n';
  }
  return `${out}\n`;
}

/** Local branches whose commits are not (all) on their upstream, or that have no upstream. */
export type UnpushedBranch = { name: string; upstream: string; count: number | null };

export function unpushedBranches(root: string): UnpushedBranch[] {
  const g = (...args: string[]) => run('git', args, { cwd: root });
  const hasRemotes = Boolean(g('for-each-ref', '--count=1', 'refs/remotes').out);
  const rows = g('for-each-ref', '--format=%(refname:short)%09%(upstream:short)', 'refs/heads')
    .out.split('\n')
    .filter(Boolean);
  const out: UnpushedBranch[] = [];
  for (const row of rows) {
    const [name, upstream = ''] = row.split('\t');
    if (upstream) {
      const n = Number(g('rev-list', '--count', `${upstream}..${name}`).out);
      if (n > 0) out.push({ name, upstream, count: n });
    } else if (hasRemotes) {
      const n = Number(g('rev-list', '--count', name, '--not', '--remotes').out);
      if (n > 0) out.push({ name, upstream: '', count: n });
    } else {
      out.push({ name, upstream: '', count: null });
    }
  }
  return out;
}

function unpushedSection({ root }: Ctx): string {
  const list = unpushedBranches(root);
  if (!list.length) return '';
  let out = "## Upstream'inde olmayan commit'li yerel dallar\n";
  for (const b of capLines(
    list.map((x) => {
      if (x.upstream) return `- ${x.name}: ${x.count} commit ${x.upstream} dalında yok`;
      if (x.count === null) return `- ${x.name}: upstream yok (uzak repo tanımlı değil)`;
      return `- ${x.name}: ${x.count} commit hiçbir uzak dalda yok (upstream yok)`;
    }),
    MAX_LIST,
  ))
    out += `${b}\n`;
  return `${out}\n`;
}

/** Open pull requests (gh), or null when GitHub is unreachable. */
function fetchOpenPrs(root: string): OpenPr[] | null {
  const pr = run('gh', ['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,statusCheckRollup'], {
    cwd: root,
    timeout: NET_TIMEOUT,
  });
  if (!pr.ok || !pr.out) return null;
  try {
    const prs = JSON.parse(pr.out);
    return Array.isArray(prs) ? prs : null;
  } catch {
    return null;
  }
}

function prSection({ prs }: Ctx): string {
  let out = "## Açık PR'lar\n";
  if (prs === null) return `${out}(GitHub'a ulaşılamadı veya oturum açılmamış)\n\n`;
  out += prs.length ? `${capLines(formatPrLines(prs), MAX_LIST).join('\n')}\n` : '(açık PR yok)\n';
  return `${out}\n`;
}

function roadmapSection({ root }: Ctx): string {
  const text = readText(path.join(root, 'docs/roadmap.md'));
  if (text === null) return '';
  const mevcut = joinTrim(sectionLines(text, /^## Mevcut durum/, /^## /));
  const open = capLines(openRoadmapItems(text), 40).join('\n');
  if (!mevcut && !open) return '';
  let out = '## Yol haritası\n';
  if (mevcut) out += `### Mevcut durum\n${mevcut}\n`;
  if (open) out += `### Açık maddeler\n${open}\n`;
  return `${out}\n`;
}

function journalSection({ root }: Ctx): string {
  const latest = listMd(path.join(root, 'docs/journal'), /^[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$/).pop();
  if (!latest) return '';
  const text = readText(latest);
  if (text === null) return '';
  const ozet = capLines(sectionLines(text, /^## Özet/, /^## /), 40);
  const body = joinTrim(ozet);
  if (!body) return '';
  return `## Son günlük özeti (docs/journal/${path.posix.basename(latest)})\n${body}\n\n`;
}

function plansSection({ root }: Ctx): string {
  const files = listMd(path.join(root, 'docs/plans'), /\.md$/).filter((f) => path.posix.basename(f) !== 'README.md');
  if (!files.length) return '';
  const lines = files.map((f) => {
    const title = (readText(f) ?? '').split('\n').find((l) => l.startsWith('# '));
    return `- docs/plans/${path.posix.basename(f)}${title ? ` — ${title.replace(/^# /, '')}` : ''}`;
  });
  return `## Planlar\n${capLines(lines, MAX_LIST).join('\n')}\n\n`;
}

function adrSection({ root }: Ctx): string {
  const files = listMd(path.join(root, 'docs/adr'), /^[0-9].*\.md$/);
  const lines = files.map((f) => (readText(f) ?? '').split('\n')[0].replace(/^# /, ''));
  return lines.length ? `## Kararlar (ADR)\n${capLines(lines, MAX_LIST).join('\n')}\n\n` : '';
}

/** The doctor is written separately and may be missing or broken; this section never fails the hook. */
function doctorSection({ root }: Ctx): string {
  const script = path.join(root, 'tooling', 'scripts', 'doctor.ts');
  if (!existsSync(script)) return '';
  const r = spawnSync(process.execPath, [script, '--json'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20000,
    windowsHide: true,
  });
  let data: unknown;
  try {
    data = JSON.parse(r.stdout ?? '');
  } catch {
    return '## Ortam kontrolü\n(doctor çalıştırılamadı veya çıktısı okunamadı: node tooling/scripts/doctor.ts)\n\n';
  }
  const { failures, warnings } = summarizeDoctor(data);
  if (!failures.length && !warnings.length) return '';
  const fmt = (tag: string) => (i: DoctorEntry) => `- [${tag}] ${i.name}${i.detail ? `: ${i.detail}` : ''}`;
  const lines = [...failures.map(fmt('HATA')), ...warnings.map(fmt('uyarı'))];
  return `## Ortam kontrolü\n${capLines(lines, MAX_LIST).join('\n')}\n(ayrıntı: node tooling/scripts/doctor.ts)\n\n`;
}

// ---------------------------------------------------------------- main

function readStdinJson() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function recordSessionStart(agentDir: string, sessionId: string): void {
  const stateDir = path.join(agentDir, 'state');
  mkdirSync(stateDir, { recursive: true });
  const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, '_');
  writeFileSync(path.join(stateDir, `session-${safe}.start`), `${Math.floor(Date.now() / 1000)}\n`);
  for (const f of readdirSync(stateDir)) {
    if (!/^session-.*\.start$/.test(f)) continue;
    try {
      if (Date.now() - statSync(path.join(stateDir, f)).mtimeMs > PRUNE_AFTER_MS) unlinkSync(path.join(stateDir, f));
    } catch {
      /* ignore */
    }
  }
}

/** Warnings about the agent folder itself. */
function agentDirWarnings(root: string, agentDir: string): string[] {
  const warnings: string[] = [];
  const rel = path.relative(canonical(root), canonical(agentDir));
  const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  if (inside && existsSync(agentDir)) {
    const r = spawnSync('git', ['check-ignore', '-q', rel], { cwd: root, windowsHide: true, timeout: 10000 });
    if (r.status === 1) {
      warnings.push(
        `UYARI: Yerel asistan klasörü (${rel.replace(/\\/g, '/')}) git tarafından yok sayılmıyor; yanlışlıkla commit'lenebilir. Hemen .git/info/exclude dosyasına \`${rel.replace(/\\/g, '/')}/\` satırını ekle.`,
      );
    }
  }
  if (!existsSync(path.join(agentDir, 'handoff.md'))) {
    warnings.push(
      `UYARI: Devir notu yok (${path.join(agentDir, 'handoff.md').replace(/\\/g, '/')}). Bu cihazda yerel asistan yapılandırması eksik olabilir; başka cihazdan kopyala veya çalışmaya başlamadan önce proje sahibine sor.`,
    );
  }
  return warnings;
}

function build(): string {
  const { agentDir: agentArg } = parseArgs(process.argv.slice(2));
  const rootRes = run('git', ['rev-parse', '--show-toplevel'], { cwd: process.cwd() });
  const root = rootRes.ok && rootRes.out ? rootRes.out : process.cwd();
  const agentDir = path.resolve(process.cwd(), agentArg ?? '.agent-dir-missing');
  const ctx: Ctx = { root, agentDir, prs: null };
  const parts: string[] = [];

  if (!agentArg) parts.push('## UYARI\n--agent-dir verilmedi; devir notu ve oturum durumu kaydedilemedi.\n\n');
  else {
    const input = readStdinJson();
    const sessionId = typeof input.session_id === 'string' && input.session_id ? input.session_id : 'unknown';
    try {
      recordSessionStart(agentDir, sessionId);
    } catch (e) {
      parts.push(`## UYARI\nOturum başlangıcı kaydedilemedi: ${e instanceof Error ? e.message : String(e)}\n\n`);
    }
    try {
      const w = agentDirWarnings(root, agentDir);
      if (w.length) parts.push(`## UYARI\n${w.join('\n')}\n\n`);
    } catch {
      /* ignore */
    }
  }

  parts.push(section('Devir notu', handoffSection, ctx));
  parts.push(section('Git durumu', gitStateSection, ctx));
  parts.push(section('Push edilmemiş dallar', unpushedSection, ctx));
  ctx.prs = fetchOpenPrs(root);
  parts.push(section("Açık PR'lar", prSection, ctx));
  parts.push(section('Yol haritası', roadmapSection, ctx));
  parts.push(section('Son günlük', journalSection, ctx));
  parts.push(section('Planlar', plansSection, ctx));
  parts.push(section('Kararlar (ADR)', adrSection, ctx));
  parts.push(section('Ortam kontrolü', doctorSection, ctx));
  parts.push(
    'Bu bağlamla kaldığın yerden devam et; proje sahibine nerede kaldığımızı sormadan, kısa bir "kaldığımız yer" özeti ve sıradaki adımı öner.\n',
  );
  const text = parts.join('');
  return text.length > MAX_TOTAL_CHARS ? `${text.slice(0, MAX_TOTAL_CHARS)}\n... (bağlam kısaltıldı)\n` : text;
}

function emit(additionalContext: string): void {
  writeSync(1, `${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let text: string;
  try {
    text = build();
  } catch (e) {
    text = `(Oturum bağlamı oluşturulamadı: ${e instanceof Error ? e.message : String(e)})\n`;
  }
  emit(text);
  process.exitCode = 0;
}
