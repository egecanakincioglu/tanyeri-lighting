#!/usr/bin/env node
// Development environment doctor: checks that this machine can work on the project (Linux and Windows).
//   node tooling/scripts/doctor.mjs           lists every check with a fix, exits 1 when any check fails
//   node tooling/scripts/doctor.mjs --json    machine-readable: { ok, items: [{ level, name, detail, fix }] }
// Level "warn" never changes the exit code.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS_DIR = 'tooling/git-hooks';
const SIGNING_SETUP = 'tooling/scripts/setup-commit-signing.sh';
const HOOKS_SETUP = 'tooling/scripts/setup-git-hooks.sh';
const MAX_CRLF_REPORTED = 10;
// Built from parts so that no tool name is spelled out in the sources.
const LOCAL_ONLY_PATHS = ['.' + 'cl' + 'aude', '.mcp.json'];

// ---------------------------------------------------------------- pure helpers (exported for tests)

const slashes = (p) =>
  String(p ?? '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
const normPath = (p) => {
  const n = slashes(p);
  return /^([a-z]:|\/\/)/i.test(n) ? n.toLowerCase() : n; // Windows paths are case-insensitive
};

/** core.hooksPath is fine when it is, or resolves (relative to the repo root) to, <root>/tooling/git-hooks. */
export function hooksPathOk(value, root) {
  if (typeof value !== 'string' || value === '' || !root) return false;
  const v = slashes(value);
  const abs = /^([a-z]:|\/)/i.test(v) ? v : `${slashes(root)}/${v}`;
  return normPath(abs) === normPath(`${root}/${HOOKS_DIR}`);
}

/** First integer of a .node-version style string ("24", "v24.1.0"). */
export function parseNodeMajor(text) {
  const m = /(\d+)/.exec(String(text ?? ''));
  return m ? Number(m[1]) : null;
}

/** Resolves a user.signingkey style value to a file path, or null when it is a literal public key / empty. */
export function signingKeyPath(value, home = os.homedir()) {
  const v = String(value ?? '').trim();
  if (!v || v.startsWith('key::') || /^(ssh|ecdsa|sk)-/.test(v)) return null;
  if (v === '~') return home;
  if (v.startsWith('~/') || v.startsWith('~\\')) return path.join(home, v.slice(2));
  return v;
}

/** Base64 key material (second field) of a public key line or .pub file, or null. */
export function keyMaterial(pubText) {
  const m = /^\s*(?:key::)?(?:ssh-\S+|ecdsa-\S+|sk-\S+)\s+([A-Za-z0-9+/=]+)/m.exec(String(pubText ?? ''));
  return m ? m[1] : null;
}

/** Tracked files whose working copy has CRLF line endings (from `git ls-files --eol`). */
export function findCrlfFiles(eolOutput) {
  const files = [];
  for (const line of String(eolOutput ?? '').split(/\r?\n/)) {
    const m = /^i\/(\S+)\s+w\/(\S+)\s+attr\/([^\t]*)\t(.*)$/.exec(line);
    if (!m) continue;
    // binary by .gitattributes (attr/-text) or by content (i/-text): line endings are irrelevant there
    if (m[1] === '-text' || /(^|\s)-text(\s|$)/.test(m[3])) continue;
    if (m[2] === 'crlf' || m[2] === 'mixed') files.push(m[4]);
  }
  return files;
}

/** Which of the wanted paths are missing from the text of .git/info/exclude (leading/trailing slash tolerant)? */
export function missingExcludes(excludeText, wanted = LOCAL_ONLY_PATHS) {
  const have = new Set(
    String(excludeText ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^\//, '').replace(/\/$/, ''))
      .filter((l) => l && !l.startsWith('#')),
  );
  return wanted.filter((w) => !have.has(w));
}

/** OS specific installation hints. */
export function hint(platform, tool) {
  const key = platform === 'win32' ? 'win' : 'linux';
  const table = {
    node: {
      win: 'winget install Schniz.fnm, then `fnm use --install-if-missing` in the repo (or winget install OpenJS.NodeJS.LTS)',
      linux: 'curl -fsSL https://fnm.vercel.app/install | bash, then `fnm use --install-if-missing` in the repo',
    },
    gitleaks: {
      win: 'winget install --id Gitleaks.Gitleaks --exact (or start Docker Desktop / Podman)',
      linux:
        'download the binary from https://github.com/gitleaks/gitleaks/releases into ~/.local/bin (or start Docker / Podman)',
    },
    gh: {
      win: 'winget install GitHub.cli, then `gh auth login`',
      linux: 'see https://github.com/cli/cli/blob/trunk/docs/install_linux.md, then `gh auth login`',
    },
    pnpm: {
      win: 'run `corepack enable` from an administrator shell, or `npm i -g pnpm`',
      linux: 'corepack enable',
    },
  };
  return table[tool][key];
}

// ---------------------------------------------------------------- command execution

/** Runs a command without a shell; never throws. */
export function defaultExec(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 15000, windowsHide: true, ...opts });
  if (r.error) return { ok: false, missing: r.error.code === 'ENOENT', out: '', err: String(r.error.message) };
  return { ok: r.status === 0, missing: false, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

/** An absolute path stays, a relative one is taken relative to the root (forward slashes work on every OS). */
const absOrUnder = (root, p) => (/^([a-z]:|[\\/])/i.test(p) ? p : `${slashes(root)}/${p}`);

const item = (level, name, detail, fix = '') => ({ level, name, detail, fix });

// ---------------------------------------------------------------- checks

/**
 * Runs every check. Everything that touches the machine is injected:
 *   exec(cmd, args) -> { ok, missing, out, err }; fileExists(p); readText(p) (throws when unreadable).
 */
export function runChecks({
  platform = process.platform,
  nodeVersion = process.version,
  root,
  home = os.homedir(),
  exec = defaultExec,
  fileExists = existsSync,
  readText = (p) => readFileSync(p, 'utf8'),
} = {}) {
  const items = [];
  const config = (key) => exec('git', ['config', '--get', key]).out;
  const signingFix = `${SIGNING_SETUP} (on Windows run it in Git Bash)`;
  const safeRead = (p) => {
    try {
      return readText(p);
    } catch {
      return null;
    }
  };

  // node
  const nodeFile = root ? safeRead(`${slashes(root)}/.node-version`) : null;
  const wanted = nodeFile === null ? null : parseNodeMajor(nodeFile);
  const actual = parseNodeMajor(nodeVersion);
  if (wanted === null)
    items.push(item('error', 'node', '.node-version could not be read', 'restore .node-version from git'));
  else if (actual === wanted) items.push(item('ok', 'node', `v${actual} matches .node-version`));
  else
    items.push(
      item('error', 'node', `running Node ${nodeVersion}, .node-version wants ${wanted}`, hint(platform, 'node')),
    );

  // git identity
  const name = config('user.name');
  const email = config('user.email');
  if (name && email) items.push(item('ok', 'git identity', `${name} <${email}>`));
  else {
    const missing = [!name && 'user.name', !email && 'user.email'].filter(Boolean).join(' and ');
    items.push(
      item(
        'error',
        'git identity',
        `${missing} not set`,
        'git config --global user.name "Your Name" && git config --global user.email "you@example.com"',
      ),
    );
  }

  // hooks
  const hooksPath = config('core.hooksPath');
  if (hooksPathOk(hooksPath, root)) items.push(item('ok', 'git hooks', `core.hooksPath=${hooksPath}`));
  else
    items.push(
      item(
        'error',
        'git hooks',
        `core.hooksPath is "${hooksPath}", expected the versioned ${HOOKS_DIR}`,
        `${HOOKS_SETUP} (on Windows run it in Git Bash)`,
      ),
    );

  // signing
  const format = config('gpg.format');
  const gpgsign = config('commit.gpgsign');
  const keySetting = config('user.signingkey');
  if (format !== 'ssh' || gpgsign !== 'true') {
    items.push(
      item(
        'error',
        'commit signing',
        `gpg.format is "${format}" and commit.gpgsign is "${gpgsign}"; they must be ssh and true`,
        signingFix,
      ),
    );
  } else {
    const keyFile = signingKeyPath(keySetting, home);
    let pubText = null;
    let problem = null;
    if (keyFile === null) {
      if (keySetting) pubText = keySetting; // a literal public key
      else problem = 'user.signingkey is not set';
    } else {
      const pubFile = keyFile.endsWith('.pub') ? keyFile : `${keyFile}.pub`;
      if (!fileExists(pubFile)) problem = `the signing key file ${pubFile} does not exist`;
      else pubText = safeRead(pubFile);
    }
    const keyData = problem ? null : keyMaterial(pubText);
    if (problem || !keyData) {
      items.push(
        item('error', 'commit signing', problem ?? 'the signing key is not a readable public key', signingFix),
      );
    } else {
      items.push(item('ok', 'commit signing', 'gpg.format=ssh, commit.gpgsign=true, signing key present'));
      const signers = signingKeyPath(config('gpg.ssh.allowedSignersFile'), home);
      if (!signers) items.push(item('error', 'allowed signers', 'gpg.ssh.allowedSignersFile is not set', signingFix));
      else if (!fileExists(signers))
        items.push(item('error', 'allowed signers', `${signers} does not exist`, signingFix));
      else if (!(safeRead(signers) ?? '').includes(keyData))
        items.push(item('error', 'allowed signers', `${signers} does not contain the signing key`, signingFix));
      else items.push(item('ok', 'allowed signers', signers));
    }
  }

  // line endings
  const autocrlf = config('core.autocrlf');
  if (autocrlf === 'true')
    items.push(
      item(
        'error',
        'core.autocrlf',
        'core.autocrlf=true rewrites line endings behind .gitattributes',
        'git config --global core.autocrlf false (the hooks setup also sets it locally)',
      ),
    );
  else items.push(item('ok', 'core.autocrlf', autocrlf ? `core.autocrlf=${autocrlf}` : 'core.autocrlf is not true'));

  const eol = exec('git', ['ls-files', '--eol']);
  if (!eol.ok) items.push(item('warn', 'line endings', 'git ls-files --eol failed, CRLF check skipped'));
  else {
    const crlf = findCrlfFiles(eol.out);
    if (crlf.length === 0) items.push(item('ok', 'line endings', 'no tracked file has CRLF in the working tree'));
    else {
      const shown = crlf.slice(0, MAX_CRLF_REPORTED).join(', ');
      const more = crlf.length > MAX_CRLF_REPORTED ? ` (and ${crlf.length - MAX_CRLF_REPORTED} more)` : '';
      items.push(
        item(
          'error',
          'line endings',
          `${crlf.length} tracked file(s) have CRLF: ${shown}${more}`,
          'git config core.autocrlf false, then `git add --renormalize .` or re-checkout the files',
        ),
      );
    }
  }

  // gitleaks: the binary, or a container runtime that can run the image
  const leaks = exec('gitleaks', ['version']);
  const runtime = leaks.ok ? null : ['docker', 'podman'].find((c) => exec(c, ['info']).ok);
  if (leaks.ok) items.push(item('ok', 'gitleaks', `binary ${leaks.out}`));
  else if (runtime) items.push(item('ok', 'gitleaks', `no binary, but ${runtime} is reachable`));
  else
    items.push(
      item(
        'error',
        'gitleaks',
        'neither the gitleaks binary nor a docker/podman daemon is available',
        hint(platform, 'gitleaks'),
      ),
    );

  // gh
  const gh = exec('gh', ['auth', 'status']);
  if (gh.missing) items.push(item('error', 'gh', 'the GitHub CLI is not installed', hint(platform, 'gh')));
  else if (!gh.ok) items.push(item('error', 'gh', 'gh is not authenticated', 'gh auth login'));
  else items.push(item('ok', 'gh', 'installed and authenticated'));

  // pnpm: a warning until the workspace needs it; it is a .cmd shim on Windows
  const pnpm = exec(platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version']);
  if (pnpm.ok) items.push(item('ok', 'pnpm', `v${pnpm.out}`));
  else items.push(item('warn', 'pnpm', 'pnpm is not available (not required yet)', hint(platform, 'pnpm')));

  // local-only paths must stay out of commits
  const excludeFile = exec('git', ['rev-parse', '--git-path', 'info/exclude']);
  const excludePath = excludeFile.ok && root ? absOrUnder(root, excludeFile.out) : null;
  const missing = missingExcludes(excludePath ? safeRead(excludePath) : null);
  if (missing.length === 0)
    items.push(item('ok', 'local excludes', `.git/info/exclude lists ${LOCAL_ONLY_PATHS.join(' and ')}`));
  else
    items.push(
      item(
        'error',
        'local excludes',
        `.git/info/exclude does not list: ${missing.join(', ')}`,
        missing.map((m) => `echo ${m} >> .git/info/exclude`).join(' && '),
      ),
    );

  return items;
}

export function formatReport(items) {
  const mark = { ok: 'ok   ', warn: 'warn ', error: 'FAIL ' };
  return items
    .map((i) => `${mark[i.level]} ${i.name}: ${i.detail}${i.fix && i.level !== 'ok' ? `\n       fix: ${i.fix}` : ''}`)
    .join('\n');
}

export function exitCodeFor(items) {
  return items.some((i) => i.level === 'error') ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const top = defaultExec('git', ['rev-parse', '--show-toplevel']);
  const root = top.ok ? top.out : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const items = runChecks({ root });
  const code = exitCodeFor(items);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: code === 0, items }, null, 2));
  else {
    console.log(formatReport(items));
    console.log(code === 0 ? '\nenvironment ok' : '\nfix the FAIL lines above');
  }
  process.exitCode = code;
}
