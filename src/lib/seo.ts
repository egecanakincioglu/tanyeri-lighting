import type { Metadata } from 'next';
import { getPathname } from '../i18n/navigation.ts';
import { routing } from '../i18n/routing.ts';
import { getSiteUrl } from '../server/env.ts';

export const SITE_NAME = 'Tanyeri Lighting';

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
const OG_LOCALES: Record<Locale, string> = { tr: 'tr_TR', en: 'en_US' };

// Canonical, hreflang and the Open Graph basics for one address. The title and description are the page's own. A page
// that sets openGraph replaces the whole object of the layout, so the shared image (the file app/opengraph-image.png) is named here.
export function pageSeo(locale: Locale, href: PageHref): Pick<Metadata, 'alternates' | 'openGraph'> {
  return {
    alternates: pageAlternates(locale, href),
    openGraph: {
      type: 'website',
      url: localizedPath(locale, href),
      locale: OG_LOCALES[locale],
      siteName: SITE_NAME,
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
    },
  };
}

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
