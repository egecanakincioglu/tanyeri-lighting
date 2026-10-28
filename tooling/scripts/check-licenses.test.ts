// Tests for check-licenses.ts: SPDX evaluation and the @img/sharp-* LGPL exception (no pnpm call).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { evaluate, isAllowed } from './check-licenses.ts';

describe('isAllowed', () => {
  test('an allowed license passes', () => assert.equal(isAllowed('MIT', 'a'), true));
  test('GPL fails', () => assert.equal(isAllowed('GPL-3.0-only', 'a'), false));
  test('AGPL and unknown fail', () => {
    assert.equal(isAllowed('AGPL-3.0-or-later', 'a'), false);
    assert.equal(isAllowed('UNKNOWN', 'a'), false);
  });
  test('AND needs every side allowed', () => {
    assert.equal(isAllowed('Apache-2.0 AND MIT', 'a'), true);
    assert.equal(isAllowed('MIT AND GPL-3.0-only', 'a'), false);
  });
  test('OR needs one side allowed', () => {
    assert.equal(isAllowed('GPL-3.0-only OR MIT', 'a'), true);
    assert.equal(isAllowed('GPL-3.0-only OR AGPL-3.0-only', 'a'), false);
  });
  test('parentheses group', () => {
    assert.equal(isAllowed('(MIT OR GPL-3.0-only) AND ISC', 'a'), true);
    assert.equal(isAllowed('MIT AND (GPL-3.0-only OR AGPL-3.0-only)', 'a'), false);
  });
  test('LGPL is allowed for @img/sharp-* packages', () => {
    assert.equal(isAllowed('Apache-2.0 AND LGPL-3.0-or-later', '@img/sharp-linux-x64'), true);
    assert.equal(isAllowed('LGPL-3.0-or-later', '@img/sharp-libvips-linux-x64'), true);
  });
  test('LGPL is rejected for any other package', () => {
    assert.equal(isAllowed('Apache-2.0 AND LGPL-3.0-or-later', 'some-lib'), false);
    assert.equal(isAllowed('LGPL-3.0-or-later', '@img/other'), false);
  });
  test('GPL is rejected even for a sharp package', () => {
    assert.equal(isAllowed('GPL-3.0-only', '@img/sharp-linux-x64'), false);
  });
});

describe('evaluate', () => {
  test('lists each offending package', () => {
    const out = evaluate({ MIT: [{ name: 'a' }], 'GPL-3.0-only': [{ name: 'b' }] });
    assert.deepEqual(out, ['b is under "GPL-3.0-only"']);
  });
  test('an empty list passes', () => assert.deepEqual(evaluate({}), []));
});
