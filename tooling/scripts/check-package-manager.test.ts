// Tests for check-package-manager.ts against temporary package.json files.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { main } from './check-package-manager.ts';

const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'pkg-mgr-'));
let counter = 0;
after(() => rmSync(root, { recursive: true, force: true }));

const HASH = 'a1b2c3d4'.repeat(16);

function run(contents: string | null): number {
  const dir = path.join(root, String(counter++));
  if (contents !== null) {
    mkdirSync(dir);
    writeFileSync(path.join(dir, 'package.json'), contents);
  }
  const err = process.stderr.write;
  const out = process.stdout.write;
  process.stderr.write = () => true;
  process.stdout.write = () => true;
  try {
    return main(dir);
  } finally {
    process.stderr.write = err;
    process.stdout.write = out;
  }
}

const pm = (value: unknown) => JSON.stringify({ packageManager: value });

describe('check-package-manager', () => {
  test('an exact version with a hash passes', () => assert.equal(run(pm(`pnpm@12.15.0+sha512.${HASH}`)), 0));
  test('a missing field fails', () => assert.equal(run('{}'), 1));
  test('another package manager fails', () => assert.equal(run(pm(`npm@10.0.0+sha512.${HASH}`)), 1));
  test('a range fails', () => {
    assert.equal(run(pm(`pnpm@^12.15.0+sha512.${HASH}`)), 1);
    assert.equal(run(pm(`pnpm@~12.15.0+sha512.${HASH}`)), 1);
  });
  test('a tag fails', () => assert.equal(run(pm('pnpm@latest')), 1));
  test('a pre-release fails', () => assert.equal(run(pm(`pnpm@12.15.0-rc.1+sha512.${HASH}`)), 1));
  test('a missing hash fails', () => assert.equal(run(pm('pnpm@12.15.0')), 1));
  test('a malformed hash fails', () => {
    assert.equal(run(pm('pnpm@12.15.0+sha512.abc')), 1);
    assert.equal(run(pm(`pnpm@12.15.0+sha512.${HASH.toUpperCase()}`)), 1);
    assert.equal(run(pm(`pnpm@12.15.0+sha1.${HASH}`)), 1);
  });
  test('a non-string value fails', () => assert.equal(run(pm(12)), 1));
  test('an unreadable or invalid package.json exits 2', () => {
    assert.equal(run(null), 2);
    assert.equal(run('not json'), 2);
  });
});
