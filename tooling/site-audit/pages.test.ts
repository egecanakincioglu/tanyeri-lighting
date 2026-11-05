import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { routing } from '../../src/i18n/routing.ts';
import { ADMIN_PAGES, LOCALES, PAGES, SIGN_IN_PAGES } from './pages.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = path.join(ROOT, 'src', 'app', '[locale]', '(site)');
const PANEL = path.join(ROOT, 'src', 'app', '[locale]', '(admin)', 'dashboard', '(panel)');

/** Routes of every page.tsx under the site group, route groups removed ('' is home).
 * Catch-all routes only answer 404. */
function routes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name.startsWith('[...')) continue;
      const seg = /^\(.*\)$/.test(e.name) ? '' : `/${e.name}`;
      out.push(...routes(path.join(dir, e.name), prefix + seg));
    } else if (e.name === 'page.tsx') out.push(prefix);
  }
  return out;
}

test('there is at least one page template', () => assert.ok(routes(SITE).length > 0));

function address(route: string, locale: (typeof LOCALES)[number]): string {
  const key = route === '' ? '/' : route;
  const entry = (routing.pathnames as Record<string, string | Record<string, string>>)[key];
  const localized = entry === undefined ? key : typeof entry === 'string' ? entry : entry[locale]!;
  return `/${locale}${localized === '/' ? '' : localized}`;
}

test('addresses follow the localized pathnames', () => {
  assert.equal(address('', 'tr'), '/tr');
  assert.equal(address('/about', 'tr'), '/tr/hakkimizda');
  assert.equal(address('/about', 'en'), '/en/about');
  assert.equal(address('/products/[slug]', 'tr'), '/tr/urunler/[slug]');
  assert.equal(address('/unlisted', 'tr'), '/tr/unlisted');
});

function isListed(expected: string, pages: readonly string[]): boolean {
  const open = expected.indexOf('[');
  if (open === -1) return pages.includes(expected);
  const prefix = expected.slice(0, open);
  return pages.some((p) => p.startsWith(prefix) && p.length > prefix.length && !p.slice(prefix.length).includes('/'));
}

test('a template with a parameter is listed by one address that fills it', () => {
  const pages = ['/tr', '/tr/urunler', '/tr/urunler/lamba'];
  assert.ok(isListed('/tr/urunler/[slug]', pages));
  assert.ok(!isListed('/tr/urunler/[slug]', ['/tr', '/tr/urunler']));
  assert.ok(!isListed('/tr/urunler/[slug]', ['/tr/urunler/a/b']));
  assert.ok(!isListed('/tr/urunler/[slug]', ['/en/products/lamba']));
  assert.ok(isListed('/tr/urunler', pages));
  assert.ok(!isListed('/tr/hizmetler', pages));
});

// Redirected addresses must not be listed: the audit accepts no redirects, so list the real localized address.
test('every page template has its localized address per locale in the audit list', () => {
  for (const route of routes(SITE)) {
    for (const locale of LOCALES) {
      const expected = address(route, locale);
      assert.ok(isListed(expected, PAGES), `missing ${expected} in tooling/site-audit/pages.ts`);
    }
  }
});

test('the audit list holds only locale-prefixed addresses without duplicates', () => {
  assert.equal(new Set(PAGES).size, PAGES.length);
  for (const p of PAGES)
    assert.ok(
      LOCALES.some((l) => p === `/${l}` || p.startsWith(`/${l}/`)),
      p,
    );
});

test('every panel screen without a parameter has its localized address per locale in the admin list', () => {
  const screens = routes(PANEL).filter((route) => !route.includes('['));
  assert.ok(screens.length > 0);
  for (const route of screens) {
    for (const locale of LOCALES) {
      const expected = address(`/dashboard${route}`, locale);
      assert.ok(ADMIN_PAGES.includes(expected), `missing ${expected} in tooling/site-audit/pages.ts`);
    }
  }
});

test('admin addresses are locale-prefixed, unique and kept out of the Lighthouse list', () => {
  assert.equal(new Set([...ADMIN_PAGES, ...SIGN_IN_PAGES]).size, ADMIN_PAGES.length + SIGN_IN_PAGES.length);
  for (const p of [...ADMIN_PAGES, ...SIGN_IN_PAGES]) {
    assert.ok(
      LOCALES.some((l) => p.startsWith(`/${l}/`)),
      p,
    );
    assert.ok(!PAGES.includes(p), `${p} must not be in PAGES`);
  }
});
