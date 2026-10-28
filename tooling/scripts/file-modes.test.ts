// Linux runs the shell scripts and git hooks by path, which needs the executable bit in the index.
// Windows ignores the bit, so only this check keeps it from being lost unnoticed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('tooling shell scripts and git hooks are executable in the index', () => {
  const r = spawnSync('git', ['ls-files', '-s', '--', 'tooling'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const entries = r.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const [mode, , , file] = l.split(/\s+/, 4);
      return { mode, file: l.slice(l.indexOf('\t') + 1) || file };
    });
  const mustRun = entries.filter(
    ({ file }) => /^tooling\/.*\.sh$/.test(file) || /^tooling\/git-hooks\/[^./]+$/.test(file),
  );
  assert.ok(mustRun.length > 0, 'no tooling scripts found');
  for (const { mode, file } of mustRun) {
    assert.equal(mode, '100755', `${file} is ${mode}; fix with: git update-index --chmod=+x ${file}`);
  }
});
