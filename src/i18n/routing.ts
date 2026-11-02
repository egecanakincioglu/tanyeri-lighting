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
    // Every panel screen has its address here, so a screen is only a page file away. The ones without a page yet are
    // answered by (panel)/[section]/page.tsx.
    '/dashboard/banner': { tr: '/yonetim/banner', en: '/admin/banner' },
    '/dashboard/featured-products': { tr: '/yonetim/one-cikan-urunler', en: '/admin/featured-products' },
    '/dashboard/promo-boards': { tr: '/yonetim/tanitim-panolari', en: '/admin/promo-boards' },
    '/dashboard/application-areas': { tr: '/yonetim/calisma-alanlari', en: '/admin/application-areas' },
    '/dashboard/settings': { tr: '/yonetim/kurumsal-ayarlar', en: '/admin/settings' },
    '/dashboard/about': { tr: '/yonetim/hakkimizda', en: '/admin/about' },
    '/dashboard/references': { tr: '/yonetim/referanslar', en: '/admin/references' },
    '/dashboard/references/new': { tr: '/yonetim/referanslar/yeni', en: '/admin/references/new' },
    '/dashboard/references/[id]': { tr: '/yonetim/referanslar/[id]', en: '/admin/references/[id]' },
    '/dashboard/services': { tr: '/yonetim/hizmetler', en: '/admin/services' },
    '/dashboard/services/new': { tr: '/yonetim/hizmetler/yeni', en: '/admin/services/new' },
    '/dashboard/services/[id]': { tr: '/yonetim/hizmetler/[id]', en: '/admin/services/[id]' },
    '/dashboard/projects': { tr: '/yonetim/projeler', en: '/admin/projects' },
    '/dashboard/projects/new': { tr: '/yonetim/projeler/yeni', en: '/admin/projects/new' },
    '/dashboard/projects/[id]': { tr: '/yonetim/projeler/[id]', en: '/admin/projects/[id]' },
    '/dashboard/products': { tr: '/yonetim/urunler', en: '/admin/products' },
    '/dashboard/products/new': { tr: '/yonetim/urunler/yeni', en: '/admin/products/new' },
    '/dashboard/products/[id]': { tr: '/yonetim/urunler/[id]', en: '/admin/products/[id]' },
    '/dashboard/categories': { tr: '/yonetim/kategoriler', en: '/admin/categories' },
    '/dashboard/categories/new': { tr: '/yonetim/kategoriler/yeni', en: '/admin/categories/new' },
    '/dashboard/categories/[id]': { tr: '/yonetim/kategoriler/[id]', en: '/admin/categories/[id]' },
    '/dashboard/catalogs': { tr: '/yonetim/kataloglar', en: '/admin/catalogs' },
    '/dashboard/catalogs/new': { tr: '/yonetim/kataloglar/yeni', en: '/admin/catalogs/new' },
    '/dashboard/catalogs/[id]': { tr: '/yonetim/kataloglar/[id]', en: '/admin/catalogs/[id]' },
    '/dashboard/messages': { tr: '/yonetim/mesajlar', en: '/admin/messages' },
    '/dashboard/legal-pages': { tr: '/yonetim/yasal-sayfalar', en: '/admin/legal-pages' },
    '/dashboard/seo': { tr: '/yonetim/sayfa-bilgileri', en: '/admin/seo' },
    '/dashboard/account': { tr: '/yonetim/hesabim', en: '/admin/account' },
  },
});

// The addresses without a parameter, which a plain link can point to.
export type StaticPath = Exclude<keyof typeof routing.pathnames, `${string}[${string}`>;
