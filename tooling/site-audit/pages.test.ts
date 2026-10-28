import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { LOCALES, PAGES } from './pages.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SITE = path.join(ROOT, 'src', 'app', '[locale]', '(site)');

/** Routes of every page.tsx under the site group, route groups removed ('' is the home page). */
function routes(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const seg = /^\(.*\)$/.test(e.name) ? '' : `/${e.name}`;
      out.push(...routes(path.join(dir, e.name), prefix + seg));
    } else if (e.name === 'page.tsx') out.push(prefix);
  }
  return out;
}

test('there is at least one page template', () => assert.ok(routes(SITE).length > 0));

test('every page template has an address per locale in the audit list', () => {
  for (const route of routes(SITE)) {
    for (const locale of LOCALES) {
      assert.ok(PAGES.includes(`/${locale}${route}`), `missing /${locale}${route} in tooling/site-audit/pages.ts`);
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
