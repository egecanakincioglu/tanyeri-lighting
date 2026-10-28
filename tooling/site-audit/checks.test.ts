import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findChrome } from './chrome.ts';
import {
  consoleProblems,
  hasHorizontalOverflow,
  imageProblem,
  redirectProblem,
  summarizeAxe,
  type ImageFacts,
} from './checks.ts';
import { DEVICES, isScreenshotDevice, sweepWidths } from './devices.ts';

test('device set has the 10 viewports of ADR 0009', () => {
  assert.equal(DEVICES.length, 10);
  assert.deepEqual(DEVICES.map((d) => `${d.width}x${d.height}`).sort(), [
    '1024x768',
    '1440x900',
    '1920x1080',
    '2560x1440',
    '320x568',
    '360x800',
    '390x844',
    '414x896',
    '768x1024',
    '844x390',
  ]);
  assert.deepEqual(
    DEVICES.filter((d) => !d.touch).map((d) => d.width),
    [1440, 1920, 2560],
  );
});

test('exactly five viewports get screenshots', () => {
  assert.deepEqual(
    DEVICES.filter(isScreenshotDevice)
      .map((d) => `${d.width}x${d.height}`)
      .sort(),
    ['1024x768', '1440x900', '390x844', '768x1024', '844x390'],
  );
});

test('sweep runs from 320 to 2560 in steps of 16 and includes 640', () => {
  const w = sweepWidths();
  assert.equal(w[0], 320);
  assert.equal(w.at(-1), 2560);
  assert.equal(w.length, 141);
  assert.ok(w.includes(640));
  assert.ok(w.every((x, i) => i === 0 || x - w[i - 1] === 16));
});

test('overflow decision: equal width passes, one pixel over fails', () => {
  assert.equal(hasHorizontalOverflow(390, 390), false);
  assert.equal(hasHorizontalOverflow(391, 390), true);
});

test('axe violations are summarized per rule with their targets', () => {
  assert.deepEqual(summarizeAxe([]), []);
  assert.deepEqual(summarizeAxe([{ id: 'target-size', nodes: [{ target: ['a.x'] }, { target: ['nav', 'button'] }] }]), [
    'target-size: a.x | nav button',
  ]);
});

test('console: errors and page errors fail, warnings and logs do not', () => {
  assert.deepEqual(
    consoleProblems([
      { type: 'log', text: 'a' },
      { type: 'warn', text: 'b' },
      { type: 'error', text: 'c' },
      { type: 'pageerror', text: 'd' },
    ]),
    ['error: c', 'pageerror: d'],
  );
});

const img = (o: Partial<ImageFacts>): ImageFacts => ({
  src: '/a.jpg',
  naturalWidth: 800,
  displayWidth: 400,
  dpr: 2,
  hasSrcset: false,
  hasSizes: false,
  ...o,
});

test('image size: exact fit and exactly double pass', () => {
  assert.equal(imageProblem(img({})), null);
  assert.equal(imageProblem(img({ naturalWidth: 1600 })), null);
});

test('image size: too small and more than double fail', () => {
  assert.match(imageProblem(img({ naturalWidth: 799 }))!, /below/);
  assert.match(imageProblem(img({ naturalWidth: 1601 }))!, /twice/);
});

test('image size: DPR counts at most 2', () => {
  assert.equal(imageProblem(img({ dpr: 3, naturalWidth: 800 })), null);
});

test('image size: hidden or widthless images skip the size check', () => {
  assert.equal(imageProblem(img({ displayWidth: 0, naturalWidth: 5000 })), null);
  assert.equal(imageProblem(img({ naturalWidth: 0 })), null);
});

test('srcset needs sizes', () => {
  assert.match(imageProblem(img({ hasSrcset: true }))!, /sizes/);
  assert.equal(imageProblem(img({ hasSrcset: true, hasSizes: true })), null);
});

test('redirect decision accepts 307 and 308 to the expected path only', () => {
  assert.equal(redirectProblem('r', { status: 307, location: '/en' }, '/en'), null);
  assert.equal(redirectProblem('r', { status: 308, location: '/en' }, '/en'), null);
  assert.match(redirectProblem('r', { status: 302, location: '/en' }, '/en')!, /status 302/);
  assert.match(redirectProblem('r', { status: 307, location: '/tr' }, '/en')!, /expected \/en/);
  assert.match(redirectProblem('r', { status: 307, location: null }, '/en')!, /null/);
});

test('chrome path: CHROME_PATH wins, then known locations per platform', () => {
  assert.equal(
    findChrome({ CHROME_PATH: '/x' }, 'linux', () => true),
    '/x',
  );
  assert.equal(
    findChrome({}, 'linux', (p) => p === '/usr/bin/google-chrome-stable'),
    '/usr/bin/google-chrome-stable',
  );
  assert.match(
    findChrome({}, 'win32', (p) => p.includes('(x86)'))!,
    /Program Files \(x86\)/,
  );
  assert.equal(
    findChrome({}, 'win32', () => false),
    null,
  );
});
