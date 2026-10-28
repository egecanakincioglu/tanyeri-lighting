// Tests for check-doc-links.ts: temporary docs trees and the real repository.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'check-doc-links.ts');
const tmp = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'doc-links-'));
let counter = 0;
after(() => rmSync(tmp, { recursive: true, force: true }));

function tree(files: Record<string, string>): string {
  const dir = path.join(tmp, `d${counter++}`);
  for (const [rel, text] of Object.entries(files)) {
    const file = path.join(dir, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return dir;
}

function run(args: string[], cwd?: string) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe('check-doc-links', () => {
  test('valid, anchor, external and nested relative links pass', () => {
    const dir = tree({
      'docs/a.md':
        '[b](b.md) [anchor](b.md#bolum) [ext](https://example.com/x) [mail](mailto:a@b.c) [nested](sub/c.md)\n',
      'docs/b.md': '[back](a.md)\n',
      'docs/sub/c.md': '[up](../a.md) [up2](../b.md#x)\n',
    });
    const r = run(['--root', dir], os.tmpdir());
    assert.equal(r.code, 0, r.err);
    assert.equal(r.out, 'checked 3 files, 0 broken links\n');
    assert.equal(r.err, '');
  });

  test('a broken link is reported with forward slashes and exits 1', () => {
    const dir = tree({
      'docs/a.md': '[ok](b.md)\n',
      'docs/b.md': 'x\n',
      'docs/sub/c.md': '[bad](../yok.md#a) [bad2](missing.md)\n',
    });
    const r = run(['--root', dir], os.tmpdir());
    assert.equal(r.code, 1);
    assert.equal(r.out, 'checked 3 files, 2 broken links\n');
    assert.match(r.err, /^broken link: docs\/sub\/c\.md -> \.\.\/yok\.md$/m);
    assert.match(r.err, /^broken link: docs\/sub\/c\.md -> missing\.md$/m);
  });

  test('root README, CONTRIBUTING and SECURITY are checked when present; other root files are not', () => {
    const dir = tree({
      'README.md': '[ok](docs/a.md) [bad](docs/yok.md)\n',
      'CONTRIBUTING.md': '[bad](gone.md)\n',
      'SECURITY.md': '[ok](README.md)\n',
      'NOTES.md': '[bad](nowhere.md)\n',
      'docs/a.md': 'x\n',
    });
    const r = run(['--root', dir], os.tmpdir());
    assert.equal(r.code, 1);
    assert.equal(r.out, 'checked 4 files, 2 broken links\n');
    assert.match(r.err, /^broken link: README\.md -> docs\/yok\.md$/m);
    assert.match(r.err, /^broken link: CONTRIBUTING\.md -> gone\.md$/m);
    assert.doesNotMatch(r.err, /NOTES/);
  });

  test('missing root files and a missing docs folder are fine', () => {
    const dir = tree({ 'src/x.txt': 'x\n' });
    const r = run(['--root', dir], os.tmpdir());
    assert.equal(r.code, 0);
    assert.equal(r.out, 'checked 0 files, 0 broken links\n');
  });

  test('links inside code blocks and inline code are ignored', () => {
    const fence = '```';
    const dir = tree({ 'docs/a.md': `${fence}md\n[x](nope.md)\n${fence}\n\nInline \`[y](nope2.md)\` text.\n[ok](a.md)\n` });
    const r = run(['--root', dir], os.tmpdir());
    assert.equal(r.code, 0, r.err);
  });

  describe('git-ignored paths', () => {
    const files = { 'docs/legacy/a.md': '[x](missing.md)\n', 'docs/ok.md': 'ok\n' };
    const repo = (ignore: string, init: boolean) => {
      const dir = tree(files);
      writeFileSync(path.join(dir, '.gitignore'), ignore);
      if (init) assert.equal(spawnSync('git', ['init', '-q'], { cwd: dir }).status, 0);
      return dir;
    };
    test('an ignored folder is not scanned', () => {
      const r = run(['--root', repo('docs/legacy/\n', true)]);
      assert.equal(r.code, 0, r.err);
      assert.match(r.out, /^checked 1 files, 0 broken links$/m);
    });
    test('the same file is reported when it is not ignored', () => {
      const r = run(['--root', repo('unrelated\n', true)]);
      assert.equal(r.code, 1);
      assert.match(r.err, /docs\/legacy\/a\.md -> missing\.md/);
    });
    test('outside a git repository nothing is filtered', () => {
      const r = run(['--root', repo('docs/legacy/\n', false)]);
      assert.equal(r.code, 1);
      assert.match(r.err, /docs\/legacy\/a\.md -> missing\.md/);
    });
  });
  test('the real repository has no broken links', () => {
    const r = run([], HERE);
    assert.equal(r.code, 0, r.err);
    assert.match(r.out, /^checked \d+ files, 0 broken links$/m);
  });
});
