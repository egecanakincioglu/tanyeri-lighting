import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from './lib/bash.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-forbidden-paths.sh');
const bash = resolveBash();

const run = (mode, paths) => {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'forbidden-paths-')));
  try {
    const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    for (const p of paths) {
      mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      writeFileSync(path.join(dir, p), 'x\n');
    }
    git('add', '-A');
    if (mode === '--all') git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x');
    const r = spawnSync(bash, [script, mode], { cwd: dir, encoding: 'utf8' });
    return { code: r.status, err: r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

const rejected = [
  '.env',
  '.env.local',
  '.env.production',
  'server/.env',
  'apps/web/.env.test',
  'database/dump.sql',
  'database/a/b.sql',
  'server/uploads/photo.jpg',
  'cert.pem',
  'deploy/tls.key',
  'store.p12',
  'store.pfx',
  'id_rsa',
  'id_rsa.pub',
  'home/id_ed25519',
  '.mcp.json',
  'tools/.mcp.json',
  'PRODUCT.md',
  'DESIGN.md',
  'design-system/tokens.css',
  'docs/brand-guidelines.md',
];
const allowed = [
  '.env.example',
  'server/.env.example',
  'src/database/client.ts',
  'docs/database/notes.md',
  'src/server/uploads.ts',
  'environment.ts',
  'keyboard.ts',
  'monkey.keys.md',
  'docs/DESIGN.md',
  'docs/design-system.md',
  'README.md',
];

describe('check-forbidden-paths.sh', { skip: bash ? false : 'bash not found' }, () => {
  for (const mode of ['--staged', '--all']) {
    describe(mode, () => {
      for (const p of rejected) {
        test(`rejects ${p}`, () => {
          const r = run(mode, [p]);
          assert.equal(r.code, 1);
          assert.ok(r.err.includes(p), r.err);
        });
      }
      test('accepts allowed paths', () => assert.equal(run(mode, allowed).code, 0));
      test('prints every offending path', () => {
        const r = run(mode, ['.env', 'cert.pem', 'ok.txt']);
        assert.equal(r.code, 1);
        assert.match(r.err, /\.env/);
        assert.match(r.err, /cert\.pem/);
        assert.doesNotMatch(r.err, /ok\.txt/);
      });
    });
  }
  test('--staged ignores tracked files that are not staged now', () => {
    const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'forbidden-paths-')));
    try {
      const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
      git('init', '-q');
      writeFileSync(path.join(dir, '.env'), 'x\n');
      git('add', '-A');
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x');
      assert.equal(spawnSync(bash, [script, '--staged'], { cwd: dir }).status, 0);
      assert.equal(spawnSync(bash, [script, '--all'], { cwd: dir }).status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test('unknown mode exits 2', () => {
    assert.equal(spawnSync(bash, [script, '--nope'], { encoding: 'utf8' }).status, 2);
  });
});
