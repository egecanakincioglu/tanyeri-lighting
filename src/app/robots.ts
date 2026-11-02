import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { routing } from '../i18n/routing.ts';
import { absoluteUrl, localizedPath } from '../lib/seo.ts';
import { isIndexingEnabled } from '../server/env.ts';

// One rule for every crawler, no names. The API and the admin area, which holds the sign-in page, are closed in both
// languages; while indexing is off the whole site is closed. The settings are read per request, not frozen at build.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const closed = ['/api/', ...routing.locales.map((locale) => localizedPath(locale, '/dashboard'))];
  return {
    rules: isIndexingEnabled() ? { userAgent: '*', allow: '/', disallow: closed } : { userAgent: '*', disallow: '/' },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
