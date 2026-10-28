#!/usr/bin/env node
// PreToolUse guard for AI coding agents (reads the tool call as JSON on stdin).
// Denies: commits/merges on main, pushes to main, force pushes to any branch, hook bypass (--no-verify),
// writing core.hooksPath, admin-override merges, commit-signing bypass, rewriting already-pushed history,
// non-merge-commit or non-queued pull request merges, writes to repository/account settings through
// gh or the GitHub API, pushing tags and creating releases (the prod gate).
//
// Portable: Node only (no jq, no bash, no GNU tools), so it behaves the same on Linux and Windows.
// Fail closed: any internal error or unparsable input is a deny, never an allow.
// Commands that target a different git repository are not judged by this repository's rules.
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, statSync, writeSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

class Deny extends Error {}

const IS_WIN = process.platform === 'win32';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const MAX_DEPTH = 8;

// ---------------------------------------------------------------- shell parsing
// A small, quote-aware shell parser: enough to split a command line into commands,
// groups and substitutions. It never executes anything.

const WORD_BREAK = new Set([' ', '\t', '\r', '\n', ';', '|', '(', ')']);

// `ps` selects PowerShell quoting (backslash literal, backtick escape); default is POSIX sh / bash.
function parseScript(src, ps = false) {
  return parseList({ s: src, i: 0, ps }, false);
}

function parseList(p, inGroup) {
  const { s } = p;
  const items = [];
  let cur = [];
  const pendingHeredocs = [];
  const flush = () => {
    if (cur.length) items.push({ kind: 'cmd', words: cur });
    cur = [];
  };
  while (p.i < s.length) {
    const c = s[p.i];
    if (c === '\n') {
      flush();
      p.i++;
      readHeredocBodies(p, pendingHeredocs);
    } else if (c === ' ' || c === '\t' || c === '\r') {
      p.i++;
    } else if (c === '#') {
      while (p.i < s.length && s[p.i] !== '\n') p.i++;
    } else if (c === ';') {
      flush();
      while (s[p.i] === ';') p.i++;
    } else if (c === '|') {
      flush();
      p.i += s[p.i + 1] === '|' || s[p.i + 1] === '&' ? 2 : 1;
    } else if (c === '&' && s[p.i + 1] !== '>') {
      flush();
      p.i += s[p.i + 1] === '&' ? 2 : 1;
    } else if (c === '(') {
      flush();
      p.i++;
      items.push({ kind: 'group', items: parseList(p, true) });
    } else if (c === ')') {
      p.i++;
      if (inGroup) {
        flush();
        return items;
      }
    } else if (c === '<' && s[p.i + 1] === '<' && s[p.i + 2] !== '<') {
      p.i += 2;
      let strip = false;
      if (s[p.i] === '-') {
        strip = true;
        p.i++;
      }
      while (s[p.i] === ' ' || s[p.i] === '\t') p.i++;
      const delim = readWord(p);
      pendingHeredocs.push({ delim: delim.text, strip });
    } else {
      cur.push(readWord(p));
    }
  }
  flush();
  return items;
}

function readHeredocBodies(p, pending) {
  const { s } = p;
  while (pending.length) {
    const { delim, strip } = pending.shift();
    while (p.i < s.length) {
      let eol = s.indexOf('\n', p.i);
      if (eol === -1) eol = s.length;
      let line = s.slice(p.i, eol).replace(/\r$/, '');
      p.i = Math.min(eol + 1, s.length);
      if (strip) line = line.replace(/^\t+/, '');
      if (line === delim) break;
    }
  }
}

function readWord(p) {
  const { s } = p;
  const word = { text: '', dyn: false, subs: [] };
  const startI = p.i;
  while (p.i < s.length) {
    const c = s[p.i];
    if (WORD_BREAK.has(c)) break;
    if (p.ps && (c === '`' || c === "'" || c === '"')) {
      readPsQuoted(p, word, c);
    } else if (c === '&') {
      const prev = word.text[word.text.length - 1];
      if (!(prev === '>' || prev === '<' || p.i === startI)) break;
      word.text += c;
      p.i++;
    } else if (c === '\\' && !p.ps) {
      if (s[p.i + 1] === '\n') p.i += 2;
      else {
        if (p.i + 1 < s.length) word.text += s[p.i + 1];
        p.i += 2;
      }
    } else if (c === "'") {
      const close = s.indexOf("'", p.i + 1);
      const end = close === -1 ? s.length : close;
      word.text += s.slice(p.i + 1, end);
      p.i = end + 1;
    } else if (c === '"') {
      p.i++;
      readDoubleQuoted(p, word);
    } else if (c === '$' || c === '`') {
      readDollarOrBacktick(p, word);
    } else {
      word.text += c;
      p.i++;
    }
  }
  return word;
}

// PowerShell: backtick escapes the next char (backtick-newline continues the line); single quotes are literal
// ('' is a quote); double quotes expand $ and use backtick or "" as escapes. Backslash is never special.
function readPsQuoted(p, word, c) {
  const { s } = p;
  if (c === '`') {
    if (s[p.i + 1] === '\n') p.i += 2;
    else if (s[p.i + 1] === '\r' && s[p.i + 2] === '\n') p.i += 3;
    else {
      if (p.i + 1 < s.length) word.text += s[p.i + 1];
      p.i += 2;
    }
    return;
  }
  p.i++;
  while (p.i < s.length) {
    const d = s[p.i];
    if (d === c) {
      if (s[p.i + 1] === c) {
        word.text += c;
        p.i += 2;
      } else {
        p.i++;
        return;
      }
    } else if (c === '"' && d === '`') {
      if (p.i + 1 < s.length) word.text += s[p.i + 1];
      p.i += 2;
    } else if (c === '"' && d === '$') readDollarOrBacktick(p, word);
    else {
      word.text += d;
      p.i++;
    }
  }
}

function readDoubleQuoted(p, word) {
  const { s } = p;
  while (p.i < s.length) {
    const c = s[p.i];
    if (c === '"') {
      p.i++;
      return;
    }
    if (c === '\\') {
      const n = s[p.i + 1];
      if (n === '\n') p.i += 2;
      else if (n !== undefined && '$`"\\'.includes(n)) {
        word.text += n;
        p.i += 2;
      } else {
        word.text += c;
        p.i++;
      }
    } else if (c === '$' || c === '`') {
      readDollarOrBacktick(p, word);
    } else {
      word.text += c;
      p.i++;
    }
  }
}

function readDollarOrBacktick(p, word) {
  const { s } = p;
  const c = s[p.i];
  if (c === '`') {
    let j = p.i + 1;
    let inner = '';
    while (j < s.length && s[j] !== '`') {
      if (s[j] === '\\' && s[j + 1] === '`') {
        inner += '`';
        j += 2;
      } else {
        inner += s[j];
        j++;
      }
    }
    word.subs.push(parseScript(inner));
    word.text += '`...`';
    word.dyn = true;
    p.i = j + 1;
  } else if (s[p.i + 1] === '(') {
    p.i += 2;
    word.subs.push(parseList(p, true));
    word.text += '$(...)';
    word.dyn = true;
  } else if (s[p.i + 1] === '{') {
    const close = s.indexOf('}', p.i);
    const end = close === -1 ? s.length : close + 1;
    word.text += s.slice(p.i, end);
    word.dyn = true;
    p.i = end;
  } else if (s[p.i + 1] === "'") {
    p.i++; // $'...' : let the quote handler take over
  } else {
    if (/[A-Za-z0-9_@*#?!$-]/.test(s[p.i + 1] ?? '')) word.dyn = true;
    word.text += '$';
    p.i++;
  }
}

// ---------------------------------------------------------------- paths and repos

function normPath(p) {
  let n = p.replace(/\\/g, '/');
  if (IS_WIN) n = n.replace(/^\/cygdrive\/([a-zA-Z])(\/|$)/, '$1:/').replace(/^\/([a-zA-Z])(\/|$)/, '$1:/');
  if (n.length > 1 && n.endsWith('/') && !/^[A-Za-z]:\/$/.test(n)) n = n.replace(/\/+$/, '');
  return IS_WIN ? n.toLowerCase() : n;
}

const gitEnv = { ...process.env };
for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete gitEnv[k];

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, env: gitEnv, encoding: 'utf8', timeout: 10000 });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() };
}

function canonical(p) {
  try {
    return realpathSync.native(p);
  } catch {
    return p;
  }
}

const toplevelCache = new Map();
// Returns {top} for a directory inside a repository, 'notrepo' or 'missing'.
function toplevelOf(dir) {
  const key = normPath(dir);
  if (toplevelCache.has(key)) return toplevelCache.get(key);
  let result;
  let isDir = false;
  try {
    isDir = statSync(dir).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) result = 'missing';
  else {
    const r = git(['rev-parse', '--show-toplevel', '--git-common-dir'], dir);
    const [top, common] = r.out.split(/\r?\n/).map((l) => l.trim());
    result = r.ok && top && common ? { top, common: canonical(path.resolve(dir, common)) } : 'notrepo';
  }
  toplevelCache.set(key, result);
  return result;
}

// This repository (the one containing the guard). Worktrees of it share the same git common dir.
const thisRepo = (() => {
  const r = toplevelOf(HERE);
  if (typeof r === 'string') throw new Error('cannot determine the repository of this guard');
  return r;
})();

const mixedPathCache = new Map();
function mixedPathFromMsys(p) {
  if (mixedPathCache.has(p)) return mixedPathCache.get(p);
  const r = spawnSync('cygpath', ['-w', p], { encoding: 'utf8', timeout: 5000 });
  const v = r.status === 0 ? r.stdout.trim() : null;
  mixedPathCache.set(p, v);
  return v;
}

// Resolve a directory argument against a base directory; null when it cannot be known statically.
function resolveDir(base, word) {
  if (word.dyn) return null;
  let arg = word.text;
  if (arg === '~' || arg.startsWith('~/')) arg = path.join(os.homedir(), arg.slice(1));
  else if (arg.startsWith('~')) return null;
  if (IS_WIN) {
    const m = arg.match(/^\/([a-zA-Z])(\/.*)?$/) ?? arg.match(/^\/cygdrive\/([a-zA-Z])(\/.*)?$/);
    if (m) arg = `${m[1]}:${m[2] ?? '/'}`;
    else if (arg.startsWith('/')) {
      const w = mixedPathFromMsys(arg);
      if (!w) return null;
      arg = w;
    }
  }
  if (path.isAbsolute(arg)) return path.resolve(arg);
  if (base === null) return null;
  return path.resolve(base, arg);
}

// ---------------------------------------------------------------- rule evaluation

const WRAPPERS = new Set([
  'sudo',
  'doas',
  'command',
  'exec',
  'nohup',
  'time',
  'nice',
  'env',
  'builtin',
  'xargs',
  'timeout',
  'stdbuf',
  'setsid',
  'ionice',
]);
const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', '{', 'time']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);
const ENV_ASSIGN = /^[A-Za-z_][A-Za-z0-9_]*=/;
// Environment based git configuration can switch off signing or hooks without touching any config file.
const GIT_CONFIG_ENV = /^GIT_CONFIG_(COUNT|KEY_|VALUE_|PARAMETERS|GLOBAL|SYSTEM|NOSYSTEM)/;

function baseName(text) {
  return path.posix.basename(text.replace(/\\/g, '/')).replace(/\.exe$/i, '');
}

function deny(reason) {
  throw new Deny(reason);
}

function evalItems(items, state, ctx) {
  for (const it of items) {
    if (it.kind === 'group') evalItems(it.items, { ...state }, ctx);
    else if (it.kind === 'cmd') evalCmd(it.words, state, ctx);
  }
}

function nested(ctx) {
  return { ...ctx, depth: ctx.depth + 1 };
}

function evalCmd(allWords, state, ctx) {
  if (ctx.depth > MAX_DEPTH) deny('Command nesting is too deep to inspect safely.');
  for (const w of allWords) for (const sub of w.subs) evalItems(sub, { ...state }, nested(ctx));

  // drop redirections
  const words = [];
  for (let i = 0; i < allWords.length; i++) {
    const t = allWords[i].text;
    if (/^\d*(>>?|<|>&|&>>?)$/.test(t)) i++;
    else if (/^\d*(>>?|<|>&)./.test(t) || /^&>/.test(t)) continue;
    else words.push(allWords[i]);
  }
  // leading environment assignments
  let gitDirEnv = false;
  const noteEnv = (text) => {
    if (GIT_CONFIG_ENV.test(text))
      deny(
        'Overriding git configuration through GIT_CONFIG_* environment variables is forbidden (it could disable commit signing or hooks).',
      );
    if (/^GIT_(DIR|WORK_TREE)=/.test(text)) gitDirEnv = true;
  };
  while (words.length && ENV_ASSIGN.test(words[0].text)) {
    noteEnv(words[0].text);
    words.shift();
  }
  while (words.length && KEYWORDS.has(words[0].text)) words.shift();
  // wrappers such as sudo / env / xargs / timeout
  while (words.length && WRAPPERS.has(baseName(words[0].text))) {
    const wrapper = baseName(words[0].text);
    words.shift();
    while (words.length && (words[0].text.startsWith('-') || ENV_ASSIGN.test(words[0].text))) {
      noteEnv(words[0].text);
      words.shift();
    }
    if (wrapper === 'timeout' && words.length && /^[0-9.]+[smhd]?$/.test(words[0].text)) words.shift();
  }
  if (!words.length) return;

  const name = baseName(words[0].text);
  if (name === 'cd' || name === 'pushd') {
    const arg = words.slice(1).find((w) => !w.text.startsWith('-') || w.text === '-');
    if (!arg) state.cwd = os.homedir();
    else if (arg.text === '-') state.cwd = null;
    else state.cwd = resolveDir(state.cwd, arg);
  } else if (name === 'popd') {
    state.cwd = null;
  } else if (SHELLS.has(name)) {
    const ci = words.findIndex((w, i) => i > 0 && /^-[a-zA-Z]*c[a-zA-Z]*$/.test(w.text));
    if (ci !== -1) {
      const script = words.slice(ci + 1).find((w) => !w.text.startsWith('-'));
      if (script) evalItems(parseScript(script.text), { ...state }, nested(ctx));
    } else {
      const file = words.slice(1).find((w) => !w.text.startsWith('-'));
      if (file) noteSetupScript(baseName(file.text), ctx);
    }
  } else if (name === 'export' || name === 'declare' || name === 'typeset') {
    for (const w of words.slice(1)) noteEnv(w.text);
  } else if (name === 'eval') {
    evalItems(
      parseScript(
        words
          .slice(1)
          .map((w) => w.text)
          .join(' '),
      ),
      state,
      nested(ctx),
    );
  } else if (noteSetupScript(words[0].text, ctx)) {
    // the project's own setup scripts: they may write the hooks path and the signing configuration
  } else if (name === 'git') {
    evalGit(words.slice(1), state, ctx, gitDirEnv);
  } else if (name === 'gh') {
    evalGh(words.slice(1));
  } else if (name === 'curl' || name === 'wget' || name === 'http' || name === 'https' || name === 'xh') {
    evalHttpTool(words.slice(1));
  }
}

// Records a run of one of the project's setup scripts; returns true when `text` names one.
function noteSetupScript(text, ctx) {
  const name = baseName(text);
  const hooks = name === 'setup-git-hooks' || name === 'setup-git-hooks.sh';
  const signing = name === 'setup-commit-signing' || name === 'setup-commit-signing.sh';
  if (hooks) ctx.shared.setupSeen = true;
  if (hooks || signing) ctx.shared.signingSetupSeen = true; // setup-git-hooks runs the signing setup too
  return hooks || signing;
}

const OWNER_ONLY = 'Repository and account settings are changed only by the project owner.';

const RELEASE_REASON =
  'Creating or changing releases is forbidden for the assistant: a release publishes to production and only the project owner does it.';
const RELEASE_READ = new Set(['list', 'view', 'download']);

// gh release: only the read subcommands pass; everything else (create, edit, delete, upload, ...) is denied.
function evalGhRelease(t) {
  const sub = t.slice(1).find((x) => !x.startsWith('-'));
  if (!sub || !RELEASE_READ.has(sub)) deny(RELEASE_REASON);
}

function evalGh(allArgs) {
  // global flags before the subcommand (gh -R owner/repo release create ...) must not hide it
  let start = 0;
  while (start < allArgs.length && allArgs[start].text.startsWith('-')) {
    const flag = allArgs[start].text;
    start += flag === '-R' || flag === '--repo' || flag === '--hostname' ? 2 : 1;
  }
  const args = allArgs.slice(start);
  const t = args.map((w) => w.text);
  const [a, b] = t;
  if (a === 'pr' && b === 'merge') return evalPrMerge(t);
  if (a === 'api') return evalGhApi(args.slice(1));
  if (a === 'release') return evalGhRelease(t);
  if (a === 'repo' && ['edit', 'delete', 'rename', 'archive', 'unarchive'].includes(b))
    deny(`gh repo ${b} is forbidden. ${OWNER_ONLY}`);
  if (a === 'repo' && b === 'deploy-key' && ['add', 'delete'].includes(t[2]))
    deny(`Deploy keys are managed by the project owner. ${OWNER_ONLY}`);
  if ((a === 'secret' || a === 'variable') && ['set', 'delete', 'remove'].includes(b))
    deny(`gh ${a} ${b} is forbidden. ${OWNER_ONLY}`);
  if (a === 'workflow' && ['disable', 'enable'].includes(b))
    deny(`Enabling or disabling workflows is a repository setting. ${OWNER_ONLY}`);
  if ((a === 'ssh-key' || a === 'gpg-key') && ['add', 'delete'].includes(b)) {
    deny(
      'Account keys are managed by the project owner (the signing key is registered by tooling/scripts/setup-commit-signing.sh).',
    );
  }
  if (a === 'auth' && b === 'token') deny('Printing the GitHub token is forbidden.');
  if (a === 'auth' && b === 'status' && t.some((x) => x === '-t' || x === '--show-token'))
    deny('Printing the GitHub token is forbidden.');
}

// Merge commits only, always queued with --auto (the owner approved queueing in advance, rule 4/5).
function evalPrMerge(t) {
  if (t.includes('--admin')) deny('Admin-override merges are forbidden.');
  const WITH_VALUE = new Set([
    '-A',
    '-b',
    '-F',
    '-t',
    '-R',
    '--author-email',
    '--body',
    '--body-file',
    '--subject',
    '--match-head-commit',
    '--repo',
  ]);
  let merge = false;
  let auto = false;
  let disableAuto = false;
  for (let k = 2; k < t.length; k++) {
    const a = t[k];
    if (WITH_VALUE.has(a)) k++;
    else if (a === '--squash' || a === '--rebase')
      deny('Squash and rebase merges are forbidden; use --merge (merge commit).');
    else if (a === '--merge') merge = true;
    else if (a === '--auto' || a === '--auto=true') auto = true;
    else if (a === '--disable-auto') disableAuto = true;
    else if (/^-[A-Za-z]+$/.test(a)) {
      for (const ch of a.slice(1)) {
        if (ch === 's' || ch === 'r') deny('Squash and rebase merges are forbidden; use --merge (merge commit).');
        if (ch === 'm') merge = true;
      }
    }
  }
  if (disableAuto) return;
  if (!merge) deny('gh pr merge must use --merge (merge commit): gh pr merge <N> --auto --merge --delete-branch.');
  if (!auto)
    deny(
      'gh pr merge must queue the merge with --auto (merges when every required check is green): gh pr merge <N> --auto --merge --delete-branch.',
    );
}

// GitHub API paths that change repository or account settings, or bypass the pull request flow.
const PROTECTED_API = [
  /\/protection(\/|$)/,
  /\/rulesets?(\/|$)/,
  /\/actions\/(permissions|secrets|variables|runners|oidc)(\/|$)/,
  /\/branches\//,
  /\/(hooks|keys|collaborators|invitations|environments|autolinks|topics|transfer|pages|vulnerability-alerts|automated-security-fixes|private-vulnerability-reporting|security-and-analysis)(\/|$)/,
  /\/dependabot\/secrets(\/|$)/,
  /\/code-scanning\/default-setup$/,
  /\/git\/(refs|commits|trees|tags)(\/|$)/,
  /\/releases(\/|$)/,
  /\/pulls\/[^/]+\/merge$/,
  /\/merges$/,
  /^repos\/[^/]+\/[^/]+$/,
  /^orgs\//,
  /^user\/(ssh_signing_keys|keys|gpg_keys|emails|memberships|repository_invitations)(\/|$)/,
];
const WRITE_METHOD = /^(PATCH|PUT|POST|DELETE)$/i;
const GH_API_WITH_VALUE = new Set([
  '-H',
  '--header',
  '-q',
  '--jq',
  '-t',
  '--template',
  '--hostname',
  '--cache',
  '-p',
  '--preview',
]);

function evalGhApi(args) {
  let method = null;
  let implied = false; // -f / -F / --input make gh send a POST
  let endpoint = null;
  const values = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k].text;
    let m;
    if (a === '-X' || a === '--method') method = args[++k]?.text ?? '';
    else if ((m = /^--method=(.*)$/.exec(a)) || (m = /^-X(.+)$/.exec(a))) method = m[1];
    else if (a === '-f' || a === '-F' || a === '--field' || a === '--raw-field') {
      implied = true;
      values.push(args[++k]?.text ?? '');
    } else if ((m = /^--(?:raw-)?field=(.*)$/.exec(a)) || (m = /^-[fF](.+)$/.exec(a))) {
      implied = true;
      values.push(m[1]);
    } else if (a === '--input' || a.startsWith('--input=')) {
      implied = true;
      values.push('@file');
      if (a === '--input') k++;
    } else if (GH_API_WITH_VALUE.has(a)) k++;
    else if (a.startsWith('-')) continue;
    else if (endpoint === null) endpoint = args[k];
  }
  if (endpoint === null) return;
  const raw = endpoint.text
    .replace(/^https?:\/\/[^/]+\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '');

  if (raw.toLowerCase() === 'graphql') {
    const text = values.join('\n');
    if (values.some((v) => v.startsWith('@') || /^[^=]+=@/.test(v)) || args.some((w) => w.dyn))
      deny('gh api graphql queries must be written inline so they can be inspected.');
    if (
      /mutation/i.test(text) &&
      /(BranchProtection|Ruleset|Repository|Collaborator|DeployKey|Environment|Secret|Webhook|Ref\b|Merge|Release|Tag)/i.test(
        text,
      )
    ) {
      deny(`GraphQL mutations on repository settings, refs or releases are forbidden. ${OWNER_ONLY}`);
    }
    return;
  }

  const isWrite = method !== null ? WRITE_METHOD.test(method) : implied;
  if (!isWrite) return;
  if (endpoint.dyn) deny('gh api write call with a dynamic endpoint cannot be inspected; spell out the path.');
  if (PROTECTED_API.some((re) => re.test(raw))) deny(`gh api write to "${raw}" is forbidden. ${OWNER_ONLY}`);
}

// curl / wget / httpie talking to the GitHub API with anything other than a plain read.
function evalHttpTool(args) {
  const t = args.map((w) => w.text);
  if (!t.some((a) => /api\.github\.com/i.test(a))) return;
  const writes = t.some(
    (a, k) =>
      /^-(d|F|T)$/.test(a) ||
      /^-[dFT].+/.test(a) ||
      /^--(data|data-raw|data-binary|data-urlencode|json|form|upload-file|post-data|post-file|body-data|body-file)(=|$)/.test(
        a,
      ) ||
      ((a === '-X' || a === '--request' || a === '--method') && !/^(GET|HEAD)$/i.test(t[k + 1] ?? '')) ||
      /^(-X|--request=|--method=)(?!GET$|HEAD$)./i.test(a) ||
      /^(POST|PUT|PATCH|DELETE)$/i.test(a),
  );
  if (writes)
    deny(
      'Writing to the GitHub API with curl/wget is forbidden; use gh (which the guard can inspect). Repository and account settings are changed only by the project owner.',
    );
}

const GIT_GLOBAL_WITH_VALUE = new Set([
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--exec-path',
  '--config-env',
]);
const READ_FLAGS = new Set([
  '--get',
  '--get-all',
  '--get-regexp',
  '--get-urlmatch',
  '-l',
  '--list',
  '--show-origin',
  '--show-scope',
]);
const WRITE_FLAGS = new Set(['--unset', '--unset-all', '--replace-all', '--add', '-e', '--edit']);
const CONFIG_OPTS_WITH_VALUE = new Set(['-f', '--file', '--blob', '--type', '--default', '--comment']);
const COMMIT_OPTS_WITH_VALUE = new Set([
  '-m',
  '-F',
  '-C',
  '-c',
  '-t',
  '--message',
  '--file',
  '--author',
  '--date',
  '--reuse-message',
  '--reedit-message',
  '--template',
]);

// Branch changes made earlier in the same command (e.g. `git switch -c x && git commit`).
const branchOverride = new Map();

function branchOf(top) {
  const k = normPath(top);
  if (branchOverride.has(k)) return branchOverride.get(k);
  const r = git(['symbolic-ref', '--short', 'HEAD'], top);
  return r.ok ? r.out : '';
}

const PROTECTED_SUBS = new Set(['commit', 'merge', 'push', 'rebase', 'reset', 'filter-branch', 'filter-repo']);

function evalGit(args, state, ctx, gitDirEnv) {
  const cdirs = [];
  const cfgs = [];
  let usesGitDir = gitDirEnv;
  let i = 0;
  for (; i < args.length; i++) {
    const t = args[i].text;
    if (t === '-C') cdirs.push(args[++i]);
    else if (t === '-c') cfgs.push(args[++i]?.text ?? '');
    else if (t.startsWith('--config-env=')) cfgs.push(t.slice('--config-env='.length));
    else if (t === '--config-env') cfgs.push(args[++i]?.text ?? '');
    else if (t.startsWith('--git-dir') || t.startsWith('--work-tree')) {
      usesGitDir = true;
      if (!t.includes('=')) i++;
    } else if (GIT_GLOBAL_WITH_VALUE.has(t)) i++;
    else if (t.startsWith('-')) continue;
    else break;
  }
  const sub = args[i]?.text;
  if (!sub) return;
  const rest = args.slice(i + 1);
  const restT = rest.map((w) => w.text);

  // which repository does this command act on?
  let cwd = state.cwd;
  let unresolvedC = null; // the -C argument that cannot be resolved statically
  for (const d of cdirs) {
    if (!d) continue;
    cwd = resolveDir(cwd, d);
    if (cwd === null && unresolvedC === null) unresolvedC = d.text;
  }
  const affectsGlobal = sub === 'config' && restT.some((a) => a === '--global' || a === '--system');
  let top; // this repository's toplevel, or null = another repository / not a repository: skip
  if (usesGitDir || affectsGlobal || cwd === null) top = thisRepo.top;
  else {
    const r = toplevelOf(cwd);
    if (r === 'missing') {
      top = thisRepo.top; // unknown directory: judge conservatively
      if (cdirs.length) unresolvedC = cdirs[cdirs.length - 1]?.text ?? '';
    } else if (r === 'notrepo') top = null;
    else top = normPath(r.common) === normPath(thisRepo.common) ? r.top : null;
  }
  if (top === null) return;
  const branch = branchOf(top);

  // core.hooksPath given through -c
  if (cfgs.some((c) => /^core\.hookspath(=|$)/i.test(c)))
    ctx.shared.hooksViolations.push('Changing core.hooksPath is forbidden.');
  for (const c of cfgs) checkConfigOverride(c);
  if (restT.includes('--no-gpg-sign')) deny(SIGNING_REASON);
  if (unresolvedC !== null && PROTECTED_SUBS.has(sub))
    deny(
      `Cannot resolve the git -C path "${unresolvedC}" as the shell would pass it, so git ${sub} cannot be judged. ` +
        'Use a forward-slash path (C:/Users/x) or a quoted path; in Bash an unquoted backslash is an escape character and is dropped.',
    );

  switch (sub) {
    case 'switch':
    case 'checkout': {
      const create = restT.findIndex((a) => ['-c', '-C', '--create', '--force-create', '-b', '-B'].includes(a));
      if (create !== -1) {
        const name = restT[create + 1];
        if (name) branchOverride.set(normPath(top), name);
      } else {
        const pos = restT.filter((a) => !a.startsWith('-'));
        if (!restT.includes('--') && pos.length === 1 && pos[0] !== '-') {
          if (pos[0] === 'main') branchOverride.set(normPath(top), 'main');
          else if (git(['show-ref', '--verify', '--quiet', `refs/heads/${pos[0]}`], top).ok)
            branchOverride.set(normPath(top), pos[0]);
        }
      }
      break;
    }
    case 'commit': {
      let noVerify = false;
      for (let k = 0; k < restT.length; k++) {
        const a = restT[k];
        if (a === '--') break;
        if (a === '--no-verify') noVerify = true;
        else if (/^-[a-zA-Z]+$/.test(a) && a.includes('n')) noVerify = true;
        else if (COMMIT_OPTS_WITH_VALUE.has(a)) k++;
      }
      if (noVerify) deny('Hook bypass (--no-verify) is forbidden.');
      if (branch === 'main')
        deny('Direct commits to main are forbidden. Create a branch: git switch -c <type>/<name>.');
      if (restT.slice(0, restT.indexOf('--') === -1 ? restT.length : restT.indexOf('--')).includes('--amend'))
        denyIfPushed(top, 'git commit --amend');
      break;
    }
    case 'rebase':
      if (
        !restT.some((a) =>
          ['--abort', '--continue', '--skip', '--quit', '--edit-todo', '--show-current-patch'].includes(a),
        )
      )
        denyIfPushed(top, 'git rebase');
      break;
    case 'reset':
      evalReset(restT, top);
      break;
    case 'filter-branch':
    case 'filter-repo':
      denyIfPushed(top, `git ${sub}`);
      break;
    case 'push':
      evalPush(rest, branch, top);
      break;
    case 'merge':
      if (branch === 'main') deny('Local merges into main are forbidden; merge through a pull request.');
      break;
    case 'config':
      evalConfig(restT, ctx);
      break;
    default:
  }
}

const FORCE_REASON = 'Force pushes are forbidden for the assistant: they are only run by the project owner by hand.';
const SIGNING_REASON =
  'Bypassing or weakening commit signing is forbidden: every commit must be signed (see tooling/scripts/setup-commit-signing.sh).';
const TRUTHY = /^(true|yes|on|1)$/i;
const GPGSIGN_KEY = /^(commit|tag)\.gpgsign$/i;
const FOLLOW_TAGS_KEY = /^push\.followtags$/i;
const FALSY = /^(false|no|off|0)$/i;
const SIGNING_SETTING =
  /^(user\.signingkey|gpg\.format|gpg\.program|gpg\.ssh\.program|gpg\.ssh\.allowedsignersfile|gpg\.openpgp\.program|gpg\.x509\.program|gpg\.minttl)$/i;

// git -c key=value / --config-env: nothing may weaken signing for a single command either.
function checkConfigOverride(c) {
  const eq = c.indexOf('=');
  const key = eq === -1 ? c : c.slice(0, eq);
  const value = eq === -1 ? 'true' : c.slice(eq + 1);
  if (GPGSIGN_KEY.test(key) && !TRUTHY.test(value)) deny(SIGNING_REASON);
  if (SIGNING_SETTING.test(key)) deny(SIGNING_REASON);
  if (FOLLOW_TAGS_KEY.test(key) && !FALSY.test(value)) deny(TAG_REASON);
}

// Rewriting commits that already exist on a remote is forbidden (rule 11); purely local commits may be rewritten.
function denyIfPushed(top, what) {
  const r = git(['branch', '-r', '--contains', 'HEAD'], top);
  if (!r.ok) deny(`Cannot tell whether HEAD is already pushed, so ${what} is denied (fail closed).`);
  if (r.out) {
    const where = r.out.split(/\r?\n/)[0].trim();
    deny(
      `${what} would rewrite history that is already pushed (HEAD is contained in ${where}); pushed history is never rewritten: add a new commit or merge instead.`,
    );
  }
}

// `git reset <commit>` moves the branch; it is a rewrite unless the target is HEAD or a descendant of HEAD.
function evalReset(restT, top) {
  let first = null;
  for (const a of restT) {
    if (a === '--' || a === '-p' || a === '--patch') return; // path reset: HEAD does not move
    if (a.startsWith('-')) continue;
    first = a;
    break;
  }
  if (first === null) return; // `git reset --hard` etc. without a target only touches index/worktree
  const target = git(['rev-parse', '--verify', '--quiet', `${first}^{commit}`], top);
  if (!target.ok) return; // not a commit: a path argument
  const head = git(['rev-parse', 'HEAD'], top);
  if (head.ok && head.out === target.out) return;
  if (head.ok && git(['merge-base', '--is-ancestor', 'HEAD', target.out], top).ok) return; // moving forward
  denyIfPushed(top, 'git reset');
}

const TAG_REASON =
  'Pushing tags is forbidden for the assistant: a pushed version tag starts a release and only the project owner pushes it by hand.';
const VERSION_LIKE = /^v?\d[\w.+-]*$/;

// A push source or destination that names a tag: refs/tags/..., a version-like name or an existing local tag.
function isTagRef(name, top) {
  const n = name.replace(/^\+/, '');
  if (n.startsWith('refs/tags/')) return true;
  if (n === '' || n.includes('*')) return false;
  if (VERSION_LIKE.test(n)) return true;
  if (git(['show-ref', '--verify', '--quiet', `refs/heads/${n}`], top).ok) return false;
  return git(['show-ref', '--verify', '--quiet', `refs/tags/${n}`], top).ok;
}

function evalPush(rest, branch, top) {
  const t = rest.map((w) => w.text);
  if (t.includes('--no-verify')) deny('Hook bypass (--no-verify) is forbidden.');
  if (t.includes('--mirror') || t.includes('--all'))
    deny('Pushing all branches (--all / --mirror) would include main; push the branch explicitly.');
  if (
    t.some((a) => a === '--tags' || a === '--follow-tags' || a.startsWith('--tags=') || a.startsWith('--follow-tags='))
  )
    deny(TAG_REASON);
  const force = t.some(
    (a) =>
      a === '--force' ||
      a === '--force-with-lease' ||
      a.startsWith('--force-with-lease=') ||
      a === '--force-if-includes' ||
      /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a),
  );
  if (force) deny(FORCE_REASON);
  const positionals = [];
  for (let k = 0; k < rest.length; k++) {
    const a = t[k];
    if (a === '--') {
      positionals.push(...rest.slice(k + 1));
      break;
    }
    if (a === '-o' || a === '--push-option' || a === '--repo' || a === '--receive-pack' || a === '--exec') k++;
    else if (!a.startsWith('-')) positionals.push(rest[k]);
  }
  const refspecs = positionals.slice(1); // the first positional is the remote
  if (refspecs[0]?.text === 'tag') deny(TAG_REASON); // git push <remote> tag <name>
  let targetsMain = false;
  let forcePlus = false;
  for (const w of refspecs) {
    let spec = w.text;
    if (spec.startsWith('+')) {
      forcePlus = true;
      spec = spec.slice(1);
    }
    if (spec.split(':').some((side) => isTagRef(side, top))) deny(TAG_REASON);
    const colon = spec.lastIndexOf(':');
    let dst = colon === -1 ? spec : spec.slice(colon + 1);
    if (colon === -1 && (dst === 'HEAD' || dst === '@')) dst = branch;
    dst = dst.replace(/^refs\/heads\//, '');
    if (dst === 'main' || dst.includes('*')) targetsMain = true;
    else if (w.dyn && branch === 'main') targetsMain = true;
  }
  if (forcePlus) deny(FORCE_REASON);
  if (targetsMain) deny('Pushing to main is forbidden; main changes only via merged pull requests.');
  if (branch === 'main' && refspecs.length === 0) deny('Pushing from main is forbidden.');
}

function evalConfig(t, ctx) {
  const pos = [];
  let read = false;
  let write = false;
  let unset = false;
  for (let k = 0; k < t.length; k++) {
    const a = t[k];
    if (READ_FLAGS.has(a)) read = true;
    else if (WRITE_FLAGS.has(a)) {
      write = true;
      if (a === '--unset' || a === '--unset-all') unset = true;
    } else if (CONFIG_OPTS_WITH_VALUE.has(a)) k++;
    else if (!a.startsWith('-')) pos.push(a);
  }
  const keyIdx = pos.findIndex(
    (a) => /^core\.hookspath$/i.test(a) || GPGSIGN_KEY.test(a) || SIGNING_SETTING.test(a) || FOLLOW_TAGS_KEY.test(a),
  );
  if (keyIdx === -1) return;
  const key = pos[keyIdx];
  let isWrite;
  if (write) isWrite = true;
  else if (read) isWrite = false;
  else if (pos[0] === 'set' || pos[0] === 'unset') isWrite = true;
  else if (pos[0] === 'get' || pos[0] === 'list') isWrite = false;
  else isWrite = pos.length > keyIdx + 1; // `git config <key> <value>`
  if (pos[0] === 'unset') unset = true;
  if (!isWrite) return;
  if (FOLLOW_TAGS_KEY.test(key)) {
    // switching it off is harmless; anything else (true, an unknown value) would push tags along with branches
    if (!unset && !FALSY.test(pos[keyIdx + 1] ?? '')) deny(TAG_REASON);
    return;
  }
  if (/^core\.hookspath$/i.test(key)) ctx.shared.hooksViolations.push('Changing core.hooksPath is forbidden.');
  else if (GPGSIGN_KEY.test(key)) {
    // switching signing on is harmless; anything else (false, unset, ...) is a bypass, with or without the setup script
    if (unset || !TRUTHY.test(pos[keyIdx + 1] ?? '')) deny(SIGNING_REASON);
  } else
    ctx.shared.signingViolations.push(
      'Changing the signing configuration (gpg.format, user.signingkey, allowed signers, signing program) is forbidden outside tooling/scripts/setup-commit-signing.sh.',
    );
}

// ---------------------------------------------------------------- entry point

function main() {
  const raw = readFileSync(0, 'utf8');
  const input = JSON.parse(raw);
  if (input === null || typeof input !== 'object') throw new Error('hook input is not a JSON object');
  const cmd = input.tool_input?.command;
  if (cmd === undefined || cmd === null) return;
  if (typeof cmd !== 'string') throw new Error('tool_input.command is not a string');
  if (
    !/git|gh|curl|wget|http|xh|export|declare|typeset/i.test(
      cmd,
    )
  )
    return;

  let cwd = process.cwd();
  if (typeof input.cwd === 'string' && input.cwd)
    cwd = resolveDir(process.cwd(), { text: input.cwd, dyn: false }) ?? cwd;

  const ctx = {
    depth: 0,
    shared: { setupSeen: false, signingSetupSeen: false, hooksViolations: [], signingViolations: [] },
  };
  const isPs = /^powershell$/i.test(String(input.tool_name ?? ''));
  evalItems(parseScript(cmd, isPs), { cwd }, ctx);
  if (ctx.shared.hooksViolations.length && !ctx.shared.setupSeen) deny(ctx.shared.hooksViolations[0]);
  if (ctx.shared.signingViolations.length && !ctx.shared.signingSetupSeen) deny(ctx.shared.signingViolations[0]);
}

function emitDeny(reason) {
  writeSync(
    1,
    `${JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } })}\n`,
  );
}

try {
  main();
} catch (e) {
  if (e instanceof Deny) emitDeny(e.message);
  else
    emitDeny(
      `Git guard failed (${e instanceof Error ? e.message : String(e)}); denying to fail closed. Fix the guard or the command.`,
    );
}
process.exitCode = 0;
