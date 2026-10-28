import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveBash } from './lib/bash.mjs';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-branch-name.sh');
const bash = resolveBash();
const run = (...args) => spawnSync(bash, [script, ...args], { encoding: 'utf8' });

describe('check-branch-name.sh', { skip: bash ? false : 'bash not found' }, () => {
  for (const name of ['feat/add-cart', 'fix/x', 'ci/bootstrap', 'docs/v2-plan', 'revert/bad-change']) {
    test(`accepts ${name}`, () => assert.equal(run(name).status, 0));
  }
  for (const name of ['main', 'feature/x', 'feat/Add-Cart', 'feat/add_cart', 'feat/', 'feat/-x', 'feat/x-', 'feat/a--b', 'fix']) {
    test(`rejects ${name}`, () => {
      const r = run(name);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /branch-name/);
    });
  }
  test('requires an argument', () => assert.notEqual(run().status, 0));
});
