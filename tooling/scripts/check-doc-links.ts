#!/usr/bin/env node
// Fails if any relative markdown link in docs/ (or in the root README.md, CONTRIBUTING.md, SECURITY.md, when they
// exist) points to a missing file. Anchors are ignored; links inside code blocks and inline code are not links.
//   node tooling/scripts/check-doc-links.ts [--root <dir>]
// Paths git ignores (for example the local legacy guide) are not scanned. Without --root the repository root is resolved with `git rev-parse --show-toplevel`.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withoutGitIgnored } from './lib/git-ignored.ts';

const LINK = /\]\(([^)#:\s]+)(#[^)]*)?\)/g;
const FENCE = /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;
const ROOT_FILES = ['README.md', 'CONTRIBUTING.md', 'SECURITY.md'];

function listMarkdown(dir: string, base: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listMarkdown(full, base, out);
    else if (entry.isFile() && entry.name.endsWith('.md'))
      out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

export function checkLinks(root: string): { files: string[]; broken: string[] } {
  const docs = path.join(root, 'docs');
  const files = withoutGitIgnored(root, [
    ...ROOT_FILES.filter((f) => existsSync(path.join(root, f))),
    ...(existsSync(docs) ? listMarkdown(docs, root, []).sort() : []),
  ]);
  const broken: string[] = [];
  for (const file of files) {
    const text = readFileSync(path.join(root, file), 'utf8')
      .replace(FENCE, '')
      .replace(/`[^`\n]*`/g, '');
    for (const m of text.matchAll(LINK)) {
      const target = path.normalize(path.join(root, path.dirname(file), m[1]));
      if (!existsSync(target)) broken.push(`${file} -> ${m[1]}`);
    }
  }
  return { files, broken };
}

function resolveRoot(argv: string[]): string {
  const i = argv.indexOf('--root');
  if (i !== -1 && argv[i + 1]) return path.resolve(argv[i + 1]);
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.status !== 0) {
    process.stderr.write('not inside a git repository (use --root <dir>)\n');
    process.exit(2);
  }
  return r.stdout.trim();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, broken } = checkLinks(resolveRoot(process.argv.slice(2)));
  for (const b of broken) process.stderr.write(`broken link: ${b}\n`);
  process.stdout.write(`checked ${files.length} files, ${broken.length} broken links\n`);
  process.exit(broken.length ? 1 : 0);
}
