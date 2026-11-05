import type { Metadata } from 'next';
import type { PageMetadata } from '../server/content/schemas.ts';

type Locale = 'tr' | 'en';

// A missing text keeps the site default or `fallbackTitle`. A page that carries its own title passes it as `title`.
export function toMetadata(
  saved: PageMetadata | null,
  locale: Locale,
  title?: string,
  fallbackTitle?: string,
): Metadata {
  const metadata: Metadata = {};
  const pageTitle = title || saved?.title[locale] || fallbackTitle;
  if (pageTitle) metadata.title = pageTitle;
  const description = saved?.description[locale];
  if (description) metadata.description = description;
  return metadata;
}
