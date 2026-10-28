#!/usr/bin/env node
// Roadmap/plan tick enforcement: a pull request must either change docs/roadmap.md or a docs/plans/*.md file
// (finished items are ticked in the same PR), or its description must carry an explicit opt-out line:
//
//   Roadmap: n/a - <reason>
//
// The reason must not be empty or an unfilled <placeholder>.
//
//   PR_BODY="$BODY" node tooling/scripts/check-roadmap-update.mjs --base <sha> --head <sha>
//
// The pull request description is read from the PR_BODY environment variable and is only ever treated as data.
// Exit codes: 0 ok, 1 rule violated, 2 usage or git error. Portable: Node only.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROADMAP = 'docs/roadmap.md';
const PLAN = /^docs\/plans\/(?!README\.md$)[^/]+\.md$/;
// HTML comments (the PR template's instructions) are removed first, so an example inside one never counts.
const NA_LINE = /^Roadmap: n\/a - (\S.*)$/m;

/** Files in `changedFiles` that count as a roadmap or plan update. */
export function roadmapFiles(changedFiles) {
  return changedFiles.filter((f) => f === ROADMAP || PLAN.test(f));
}

/** The reason of a valid `Roadmap: n/a - <reason>` line in the PR body, or null. */
export function naReason(body) {
  const text = String(body ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r/g, '');
  const m = NA_LINE.exec(text);
  if (!m) return null;
  const reason = m[1].trim();
  if (/^<[^<>]*>$/.test(reason)) return null; // the unfilled template placeholder
  return reason;
}

/** Decision: { ok, message }. */
export function evaluate({ changedFiles, body }) {
  const touched = roadmapFiles(changedFiles);
  if (touched.length) return { ok: true, message: `roadmap: updated (${touched.join(', ')})` };
  const reason = naReason(body);
  if (reason) return { ok: true, message: `roadmap: opted out with "Roadmap: n/a - ${reason}"` };
  return {
    ok: false,
    message:
      'roadmap: this pull request changes neither docs/roadmap.md nor docs/plans/*.md. Tick the finished item ' +
      'in the roadmap or add a line to the pull request description: `Roadmap: n/a - <reason>`.',
  };
}

function git(args, cwd) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: 30000,
  });
  return {
    ok: !r.error && r.status === 0,
    out: r.stdout ?? '',
    err: (r.stderr ?? '') || (r.error ? String(r.error.message) : ''),
  };
}

export function main(argv, env = process.env, cwd = process.cwd()) {
  const get = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const base = get('--base');
  const head = get('--head');
  if (!base || !head) {
    process.stderr.write('check-roadmap-update: --base <sha> and --head <sha> are required\n');
    return 2;
  }
  const diff = git(['diff', '--name-only', `${base}...${head}`], cwd);
  if (!diff.ok) {
    process.stderr.write(`check-roadmap-update: git diff failed: ${diff.err.trim()}\n`);
    return 2;
  }
  const changedFiles = diff.out.split(/\r?\n/).filter(Boolean);
  const result = evaluate({ changedFiles, body: env.PR_BODY });
  (result.ok ? process.stdout : process.stderr).write(`${result.message}\n`);
  return result.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
