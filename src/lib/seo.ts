import type { Metadata } from 'next';
import { getPathname } from '../i18n/navigation.ts';
import { routing } from '../i18n/routing.ts';
import { getSiteUrl } from '../server/env.ts';

const SITE_NAME = 'Tanyeri Lighting';

export type Locale = (typeof routing.locales)[number];
export type PageHref = Parameters<typeof getPathname>[0]['href'];

export function localizedPath(locale: Locale, href: PageHref): string {
  return getPathname({ locale, href });
}

export function absoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).href;
}

// The one place that decides canonical and hreflang. x-default is the root on the home page, else the default language.
const OG_LOCALES: Record<Locale, string> = { tr: 'tr_TR', en: 'en_US' };

// A page that sets openGraph replaces the layout's whole object, so the shared image is named here.
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
