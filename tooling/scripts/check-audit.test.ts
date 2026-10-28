// Tests for check-audit.ts: the pure evaluation (no network) and the missing-file exit code.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { evaluate, main } from './check-audit.ts';

const TODAY = '2026-10-28';
const audit = (severity: string) => ({
  advisories: { '1': { github_advisory_id: 'GHSA-aaaa', severity, module_name: 'left-pad' } },
});

describe('evaluate', () => {
  test('no advisories pass', () => assert.deepEqual(evaluate({ advisories: {} }, [], TODAY), []));
  test('a moderate advisory passes', () => assert.deepEqual(evaluate(audit('moderate'), [], TODAY), []));
  test('a high advisory fails', () => {
    assert.deepEqual(evaluate(audit('high'), [], TODAY), ['high advisory GHSA-aaaa in left-pad']);
  });
  test('a critical advisory fails', () => assert.equal(evaluate(audit('critical'), [], TODAY).length, 1));
  test('a valid exception allows the advisory', () => {
    const ex = [{ id: 'GHSA-aaaa', reason: 'not reachable', expires: '2026-12-01' }];
    assert.deepEqual(evaluate(audit('high'), ex, TODAY), []);
  });
  test('an expired exception fails itself and no longer covers the advisory', () => {
    const ex = [{ id: 'GHSA-aaaa', reason: 'not reachable', expires: '2026-10-01' }];
    assert.deepEqual(evaluate(audit('high'), ex, TODAY), [
      'exception GHSA-aaaa expired on 2026-10-01',
      'high advisory GHSA-aaaa in left-pad',
    ]);
  });
});

describe('main', () => {
  test('a missing exceptions file exits 2', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'audit-'));
    try {
      assert.equal(main(dir, TODAY), 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
