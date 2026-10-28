// Text-level guards for the workflow files and the Dependabot config (no YAML parser, no dependencies).
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, '.github', 'workflows');
const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f));
const read = (f: string) => readFileSync(path.join(DIR, f), 'utf8');
/** Lines without full-line comments. */
const codeLines = (f: string) => read(f).split(/\r?\n/).filter((l) => !/^\s*#/.test(l));

/** Job blocks: jobs are the 2-space-indented keys under `jobs:`. */
function jobs(f: string) {
  const lines = read(f).split(/\r?\n/);
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  assert.ok(start >= 0, `${f}: jobs: block`);
  const out: { id: string; lines: string[] }[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
    if (m) out.push({ id: m[1], lines: [] });
    else if (out.length) out.at(-1)!.lines.push(l);
  }
  return out.map((j) => ({ id: j.id, text: j.lines.join('\n') }));
}
const jobName = (j: { text: string }) => /^ {4}name:\s*(.+?)\s*$/m.exec(j.text)?.[1];

test('there are workflow files', () => assert.ok(files.length >= 3));

describe('every workflow', () => {
  for (const f of files) {
    test(`${f}: every uses: is pinned to a full commit SHA with a version comment`, () => {
      const uses = codeLines(f).filter((l) => /^\s*-?\s*uses:/.test(l));
      assert.ok(uses.length > 0);
      for (const l of uses) {
        assert.match(l, /uses:\s*\S+@[0-9a-f]{40}\s+# v\d+(\.\d+)*\s*$/, l.trim());
      }
    });

    test(`${f}: top-level permissions set contents: read`, () => {
      const lines = read(f).split(/\r?\n/);
      const i = lines.findIndex((l) => /^permissions:\s*$/.test(l));
      assert.ok(i >= 0, 'top-level permissions block');
      assert.match(lines[i + 1] as string, /^ {2}contents: read\s*$/);
    });

    test(`${f}: every job has a time limit and a GitHub-hosted runner`, () => {
      for (const j of jobs(f)) {
        assert.match(j.text, /^ {4}timeout-minutes:\s*\d+\s*$/m, `${f} job ${j.id}: timeout-minutes`);
        const runner = /^ {4}runs-on:\s*(\S+)\s*$/m.exec(j.text)?.[1];
        assert.ok(['ubuntu-latest', 'windows-latest'].includes(runner as string), `${f} job ${j.id}: ${runner}`);
      }
    });

    test(`${f}: no run line interpolates event text`, () => {
      const lines = read(f).split(/\r?\n/);
      lines.forEach((l, i) => {
        if (/^\s*run:/.test(l)) assert.ok(!l.includes('${{ github.event'), `line ${i + 1}`);
      });
      // Multi-line scripts: every line of a run block.
      let inRun = false;
      let indent = 0;
      for (const [i, l] of lines.entries()) {
        const m = /^(\s*)(- )?run:\s*[|>]/.exec(l);
        if (m) {
          inRun = true;
          indent = m[1].length + (m[2] ? 2 : 0);
          continue;
        }
        if (inRun) {
          if (l.trim() !== '' && l.search(/\S/) <= indent) inRun = false;
          else assert.ok(!l.includes('${{ github.event'), `line ${i + 1} in a run block`);
        }
      }
    });

    test(`${f}: referenced tooling/scripts paths exist`, () => {
      const paths = new Set(read(f).match(/tooling\/scripts\/[A-Za-z0-9._-]+/g) ?? []);
      for (const p of paths) assert.ok(existsSync(path.join(ROOT, p)), p);
    });
  }
});

describe('required check names', () => {
  const names = new Map();
  for (const f of files) for (const j of jobs(f)) names.set(jobName(j), f);
  for (const n of ['policy', 'tooling (linux)', 'tooling (windows)', 'pr-text']) {
    test(`job "${n}" exists`, () => assert.ok(names.has(n), `missing job ${n}`));
  }
});

describe('dependabot.yml', () => {
  const text = readFileSync(path.join(ROOT, '.github', 'dependabot.yml'), 'utf8');
  for (const eco of ['github-actions', 'docker', 'npm']) {
    test(`covers ${eco}`, () => assert.match(text, new RegExp(`package-ecosystem: '${eco}'`)));
  }
  test('holds prisma back on major updates', () => {
    assert.match(text, /dependency-name: 'prisma'/);
    assert.match(text, /dependency-name: '@prisma\/\*'/);
  });
});
