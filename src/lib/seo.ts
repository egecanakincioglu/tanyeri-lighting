import type { Metadata } from 'next';
import { getPathname } from '../i18n/navigation.ts';
import { routing } from '../i18n/routing.ts';
import { getSiteUrl } from '../server/env.ts';

export type Locale = (typeof routing.locales)[number];
export type PageHref = Parameters<typeof getPathname>[0]['href'];

export function localizedPath(locale: Locale, href: PageHref): string {
  return getPathname({ locale, href });
}

export function absoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).href;
}

// The one place that decides canonical and hreflang. The paths are relative; metadataBase makes them absolute.
// x-default is the root address on the home page (it redirects by language) and the default language elsewhere.
export function pageAlternates(locale: Locale, href: PageHref): NonNullable<Metadata['alternates']> {
  return {
    canonical: localizedPath(locale, href),
    languages: {
      tr: localizedPath('tr', href),
      en: localizedPath('en', href),
      'x-default': href === '/' ? '/' : localizedPath(routing.defaultLocale, href),
    },
  };
}
