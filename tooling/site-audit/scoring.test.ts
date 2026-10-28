import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  agenticFailures,
  judge,
  median,
  medianRun,
  medianScores,
  transferOf,
  type LhrLike,
  type Thresholds,
  type Transfer,
} from './scoring.ts';

const t = JSON.parse(readFileSync(new URL('./thresholds.json', import.meta.url), 'utf8')) as Thresholds;

function lhr(perf: number, items: { resourceType: string; transferSize: number }[] = []): LhrLike {
  return {
    categories: {
      performance: { score: perf / 100 },
      accessibility: { score: 1 },
      'best-practices': { score: 1 },
      seo: { score: 1 },
    },
    audits: { 'network-requests': { score: null, details: { items } } },
  };
}
const scores = { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 };
const small: Transfer = { scriptKB: 100, stylesheetKB: 10, fontFiles: 1, fontKB: 40, totalKB: 300 };

test('thresholds file has the ADR 0010 shape', () => {
  assert.deepEqual(t.categories, { performance: 90, accessibility: 90, 'best-practices': 90, seo: 90 });
  assert.equal(t.expected, 95);
  assert.deepEqual(t.budgets, { scriptKB: 180, stylesheetKB: 30, fontFiles: 2, fontKB: 100, totalKB: 500 });
});

test('median of odd and even lists, and of nothing', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.throws(() => median([]));
});

test('medianScores and medianRun pick the middle of three runs', () => {
  const runs = [lhr(80), lhr(99), lhr(92)];
  assert.equal(medianScores(runs).performance, 92);
  assert.equal(medianRun(runs), runs[2]);
});

test('transferOf sums by resource type and counts fonts', () => {
  const r = lhr(100, [
    { resourceType: 'Script', transferSize: 2048 },
    { resourceType: 'Script', transferSize: 1024 },
    { resourceType: 'Stylesheet', transferSize: 1024 },
    { resourceType: 'Font', transferSize: 2048 },
    { resourceType: 'Document', transferSize: 1024 },
  ]);
  assert.deepEqual(transferOf(r), { scriptKB: 3, stylesheetKB: 1, fontFiles: 1, fontKB: 2, totalKB: 7 });
});

test('agenticFailures ignores not applicable, informative and passing audits', () => {
  const r = lhr(100);
  r.categories['agentic-browsing'] = { score: null, auditRefs: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] };
  r.audits.a = { title: 'A', score: 0, scoreDisplayMode: 'binary' };
  r.audits.b = { title: 'B', score: null, scoreDisplayMode: 'notApplicable' };
  r.audits.c = { title: 'C', score: 1, scoreDisplayMode: 'binary' };
  r.audits.d = { title: 'D', score: 0, scoreDisplayMode: 'informative' };
  assert.deepEqual(agenticFailures(r), ['A']);
  assert.deepEqual(agenticFailures(lhr(100)), []);
});

test('judge: at or above expected is clean', () => {
  assert.deepEqual(judge('p', scores, small, [], t), { failures: [], warnings: [] });
});

test('judge: 90-94 warns, below 90 fails, exactly 90 and 95 are not red', () => {
  const warn = judge('p', { ...scores, seo: 90, performance: 94 }, small, [], t);
  assert.equal(warn.failures.length, 0);
  assert.equal(warn.warnings.length, 2);
  assert.equal(judge('p', { ...scores, seo: 95 }, small, [], t).warnings.length, 0);
  const red = judge('p', { ...scores, accessibility: 89 }, small, [], t);
  assert.equal(red.failures.length, 1);
  assert.match(red.failures[0]!, /accessibility 89 is below 90/);
});

test('judge: each budget fails only above its limit', () => {
  assert.equal(judge('p', scores, { ...small, scriptKB: 180, totalKB: 500, fontFiles: 2 }, [], t).failures.length, 0);
  for (const over of [{ scriptKB: 181 }, { stylesheetKB: 31 }, { fontFiles: 3 }, { fontKB: 101 }, { totalKB: 501 }]) {
    const v = judge('p', scores, { ...small, ...over }, [], t);
    assert.equal(v.failures.length, 1, JSON.stringify(over));
  }
});

test('judge: a failed agentic audit is red', () => {
  const v = judge('p', scores, small, ['llms.txt'], t);
  assert.equal(v.failures.length, 1);
  assert.match(v.failures[0]!, /llms\.txt/);
});
