import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { routing } from '../i18n/routing.ts';
import { absoluteUrl, localizedPath, type PageHref } from '../lib/seo.ts';
import { getLegalPage } from '../server/content/legal-pages.ts';
import { getPageMetadata } from '../server/content/page-metadata.ts';
import { listCategoryChanges } from '../server/content/categories.ts';
import { listProductChanges } from '../server/content/products.ts';
import { LEGAL_PAGE_KEYS, PAGE_KEYS, type LegalPageKey, type PageKey } from '../server/content/schemas.ts';

type Entry = { href: PageHref; modified?: Date };

const isLegal = (key: PageKey): key is LegalPageKey => (LEGAL_PAGE_KEYS as readonly string[]).includes(key);

const later = (a?: Date, b?: Date) => (a && b ? (a > b ? a : b) : (a ?? b));

async function pageEntry(key: PageKey): Promise<Entry | null> {
  const [metadata, legal] = await Promise.all([getPageMetadata(key), isLegal(key) ? getLegalPage(key) : undefined]);
  // A legal page that was never saved answers 404, so it is not listed.
  if (legal === null) return null;
  return { href: key === 'home' ? '/' : `/${key}`, modified: later(metadata?.updatedAt, legal?.updatedAt) };
}

// Every public address in every language. It reads the database, so it is built per request; when a read fails the
// error propagates and the answer is a server error, never a list with pages missing.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [pages, products, categories] = await Promise.all([
    Promise.all(PAGE_KEYS.map(pageEntry)),
    listProductChanges(),
    listCategoryChanges(),
  ]);
  const entries: Entry[] = [
    ...pages.filter((page) => page !== null),
    // Each category view is its own indexable address of the product list.
    ...categories.map((category) => ({
      href: { pathname: '/products', query: { category: category.key } } as const,
      modified: category.updatedAt,
    })),
    ...products.map((product) => ({
      href: { pathname: '/products/[slug]', params: { slug: product.slug } } as const,
      modified: product.updatedAt,
    })),
  ];
  return entries.flatMap(({ href, modified }) =>
    routing.locales.map((locale) => ({
      url: absoluteUrl(localizedPath(locale, href)),
      ...(modified ? { lastModified: modified } : {}),
    })),
  );
}
