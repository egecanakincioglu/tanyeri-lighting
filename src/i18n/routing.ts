import { defineRouting } from 'next-intl/routing';

// Page addresses are keyed by the English path; Turkish pages use Turkish addresses (ADR 0006).
export const routing = defineRouting({
  locales: ['tr', 'en'],
  defaultLocale: 'tr',
  localePrefix: 'always',
  alternateLinks: false,
  pathnames: {
    '/': '/',
    '/about': { tr: '/hakkimizda', en: '/about' },
    '/vision': { tr: '/vizyon', en: '/vision' },
    '/references': { tr: '/referanslar', en: '/references' },
    '/services': { tr: '/hizmetler', en: '/services' },
    '/projects': { tr: '/projeler', en: '/projects' },
    '/products': { tr: '/urunler', en: '/products' },
    '/products/[slug]': { tr: '/urunler/[slug]', en: '/products/[slug]' },
    '/catalogs': { tr: '/kataloglar', en: '/catalogs' },
    '/contact': { tr: '/iletisim', en: '/contact' },
    '/privacy': { tr: '/gizlilik', en: '/privacy' },
    '/terms': { tr: '/kullanim-kosullari', en: '/terms' },
    // The admin side lives in the (admin)/dashboard folder, which tooling/scripts/check-admin-guard.ts expects.
    '/dashboard': { tr: '/yonetim', en: '/admin' },
    '/dashboard/sign-in': { tr: '/yonetim/giris', en: '/admin/sign-in' },
  },
});

// The addresses without a parameter, which a plain link can point to.
export type StaticPath = Exclude<keyof typeof routing.pathnames, `${string}[${string}`>;
