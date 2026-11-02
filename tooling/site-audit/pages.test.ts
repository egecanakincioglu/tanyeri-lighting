import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { routing } from '../../src/i18n/routing.ts';
import { ADMIN_PAGES, LOCALES, PAGES } from './pages.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = path.join(ROOT, 'src', 'app', '[locale]', '(site)');

/**
 * Routes of every page.tsx under the site group, route groups removed ('' is the home page). Catch-all routes only
 * answer 404, so they are not page templates.
 */
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

/** The address a visitor reaches: the folder route looked up in routing.pathnames, or the folder route itself. */
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

/** A static address must be listed as is; a template ending in a parameter, by any listed address that fills it. */
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

// A folder-derived address that the site would redirect (307) to its localized form must not be in the list: the
// audit does not accept redirects, so each template is listed under its real localized address.
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

test('admin addresses are locale-prefixed, unique and kept out of the Lighthouse list', () => {
  assert.equal(new Set(ADMIN_PAGES).size, ADMIN_PAGES.length);
  for (const p of ADMIN_PAGES) {
    assert.ok(
      LOCALES.some((l) => p.startsWith(`/${l}/`)),
      p,
    );
    assert.ok(!PAGES.includes(p), `${p} must not be in PAGES`);
  }
});
