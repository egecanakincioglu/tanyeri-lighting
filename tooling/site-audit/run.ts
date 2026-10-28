#!/usr/bin/env node
// Site audit (ADR 0009 rule 13). Starts `next start` on port 3000 (run `pnpm build` first), audits every page of
// pages.ts in a real Chrome and stops the server again.
//
//   node tooling/site-audit/run.ts --leg pages
//
// Report: site-audit-report/report.json and screenshots/. Exit codes: 0 ok, 1 audit failures, 2 setup problem
// (usage, Chrome missing, server did not start).
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type AxeCore from 'axe-core';
import puppeteer, { type Page } from 'puppeteer-core';
import {
  consoleProblems,
  hasHorizontalOverflow,
  imageProblem,
  redirectProblem,
  summarizeAxe,
  type ConsoleEntry,
  type ImageFacts,
} from './checks.ts';
import { findChrome } from './chrome.ts';
import { DEVICES, SWEEP_HEIGHT, isScreenshotDevice, sweepWidths, type Device } from './devices.ts';
import { PAGES } from './pages.ts';

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const REPORT_DIR = path.resolve('site-audit-report');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const require = createRequire(import.meta.url);

const failures: string[] = [];
const fail = (where: string, what: string) => failures.push(`${where}: ${what}`);

async function startServer(): Promise<ChildProcess> {
  if (
    await fetch(BASE, { redirect: 'manual' }).then(
      () => true,
      () => false,
    )
  ) {
    throw new Error(`port ${PORT} is already in use`);
  }
  const next = require.resolve('next/dist/bin/next');
  const child = spawn(process.execPath, [next, 'start', '-p', String(PORT)], {
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: process.platform !== 'win32',
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited with ${child.exitCode}`);
    if (
      await fetch(`${BASE}/tr`, { redirect: 'manual' }).then(
        () => true,
        () => false,
      )
    )
      return child;
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(child);
  throw new Error('server did not become ready in 60 s');
}

function stopServer(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  else process.kill(-child.pid, 'SIGTERM');
}

async function redirectOf(pathname: string, lang?: string) {
  const res = await fetch(BASE + pathname, { redirect: 'manual', headers: lang ? { 'accept-language': lang } : {} });
  const loc = res.headers.get('location');
  return { status: res.status, location: loc ? new URL(loc, BASE).pathname : null };
}

async function httpChecks(): Promise<void> {
  for (const p of PAGES) {
    const res = await fetch(BASE + p, { redirect: 'manual' });
    if (res.status !== 200) fail(`http ${p}`, `status ${res.status}, expected 200`);
  }
  const roots: [string, string | undefined, string][] = [
    ['/ with Accept-Language en', 'en', '/en'],
    ['/ with Accept-Language tr', 'tr', '/tr'],
    ['/ without Accept-Language', undefined, '/tr'],
  ];
  for (const [label, lang, expected] of roots) {
    const problem = redirectProblem(label, await redirectOf('/', lang), expected);
    if (problem) fail('http', problem);
  }
  const unknown = await fetch(`${BASE}/xx`);
  if (unknown.status !== 404) fail('http /xx', `status ${unknown.status}, expected 404`);
}

async function setViewport(page: Page, d: Pick<Device, 'width' | 'height' | 'touch' | 'dpr'>) {
  await page.setViewport({
    width: d.width,
    height: d.height,
    deviceScaleFactor: d.dpr,
    hasTouch: d.touch,
    isMobile: d.touch,
  });
}

async function overflowSweep(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'networkidle0' });
  for (const width of sweepWidths()) {
    await setViewport(page, { width, height: SWEEP_HEIGHT, touch: false, dpr: 1 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (hasHorizontalOverflow(scrollWidth, width)) fail(`overflow ${url} @${width}`, `scrollWidth ${scrollWidth}`);
  }
}

async function auditView(page: Page, url: string, d: Device, axeSource: string): Promise<void> {
  const where = `${url} @${d.width}x${d.height}`;
  const entries: ConsoleEntry[] = [];
  const onConsole = (m: { type(): string; text(): string }) => entries.push({ type: m.type(), text: m.text() });
  const onPageError = (e: unknown) => entries.push({ type: 'pageerror', text: String(e) });
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  await setViewport(page, d);
  await page.goto(url, { waitUntil: 'networkidle0' });

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  if (hasHorizontalOverflow(scrollWidth, d.width)) fail(`overflow ${where}`, `scrollWidth ${scrollWidth}`);

  const violations = await page.evaluate(() => {
    const w = window as unknown as { __csp: string[] };
    return w.__csp;
  });
  for (const v of violations) fail(`csp ${where}`, v);

  const modals = await page.evaluate(
    () =>
      [...document.querySelectorAll('dialog[open], [aria-modal="true"]')].filter(
        (el) => el.matches('dialog[open]') || el.getClientRects().length > 0,
      ).length,
  );
  if (modals > 0) fail(`modal ${where}`, `${modals} modal(s) open on load`);

  const images: ImageFacts[] = await page.evaluate(
    (dpr) =>
      [...document.images].map((img) => ({
        src: img.currentSrc || img.src,
        naturalWidth: img.naturalWidth,
        displayWidth: img.getBoundingClientRect().width,
        dpr,
        hasSrcset: img.hasAttribute('srcset'),
        hasSizes: img.hasAttribute('sizes'),
      })),
    d.dpr,
  );
  for (const img of images) {
    const problem = imageProblem(img);
    if (problem) fail(`image ${where}`, problem);
  }

  await page.evaluate(axeSource);
  const axeResult = await page.evaluate(async (tags) => {
    const axe = (window as unknown as { axe: typeof AxeCore }).axe;
    const r = await axe.run(document, { runOnly: { type: 'tag', values: tags } });
    return r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => ({ target: [...n.target] })) }));
  }, AXE_TAGS);
  for (const s of summarizeAxe(axeResult)) fail(`axe ${where}`, s);

  if (isScreenshotDevice(d)) {
    const slug = new URL(url).pathname.slice(1).replaceAll('/', '-');
    await page.screenshot({ path: path.join(REPORT_DIR, 'screenshots', `${slug}-${d.width}x${d.height}.png`) });
  }

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
  for (const p of consoleProblems(entries)) fail(`console ${where}`, p);
}

async function browserChecks(): Promise<string> {
  const executablePath = findChrome(process.env, process.platform, existsSync);
  if (!executablePath) throw new Error('Chrome not found; set CHROME_PATH');
  const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    const version = await browser.version();
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__csp.push(`${e.violatedDirective} blocked ${e.blockedURI}`);
      });
    });
    for (const url of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'networkidle0' });
    }
    for (const p of PAGES) {
      const url = BASE + p;
      await overflowSweep(page, url);
      for (const d of DEVICES) await auditView(page, url, d, axeSource);
    }
    return version;
  } finally {
    await browser.close();
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { leg: { type: 'string' } }, strict: true });
  if (values.leg !== 'pages') {
    console.error('usage: node tooling/site-audit/run.ts --leg pages');
    return 2;
  }
  const started = Date.now();
  rmSync(REPORT_DIR, { recursive: true, force: true });
  mkdirSync(path.join(REPORT_DIR, 'screenshots'), { recursive: true });

  let server: ChildProcess | undefined;
  let chrome = 'unknown';
  try {
    server = await startServer();
    await httpChecks();
    chrome = await browserChecks();
  } catch (err) {
    console.error(`site-audit: ${(err as Error).stack ?? String(err)}`);
    return 2;
  } finally {
    if (server) stopServer(server);
  }

  const seconds = Math.round((Date.now() - started) / 1000);
  writeFileSync(
    path.join(REPORT_DIR, 'report.json'),
    JSON.stringify({ leg: 'pages', chrome, pages: PAGES, seconds, failures }, null, 2),
  );
  for (const f of failures) console.error(`FAIL ${f}`);
  console.log(`site-audit (pages): ${failures.length} failure(s), ${seconds} s, ${chrome}`);
  return failures.length === 0 ? 0 : 1;
}

process.exitCode = await main();
