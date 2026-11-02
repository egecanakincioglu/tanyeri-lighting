import type { Metadata } from 'next';
import type { PageMetadata } from '../server/content/schemas.ts';

type Locale = 'tr' | 'en';

// A page without saved metadata (or without a text for the language) keeps the site default, or the `fallbackTitle` the
// page names. A page whose own content carries the title passes it as `title`; the saved description still applies.
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
