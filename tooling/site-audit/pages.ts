// Every public page the audit visits. A page template under src/app/[locale]/(site) without an address here fails
// pages.test.ts, so a new template can not ship unaudited.
//
// Admin screens are listed apart in ADMIN_PAGES. They are noindex by design, so Lighthouse would score their SEO
// below the gate; they get the browser checks (accessibility, overflow, console, status) but no Lighthouse run.
export const LOCALES = ['tr', 'en'] as const;

// A dynamic template is listed with one seeded address, which stands for the template.
export const PAGES: readonly string[] = [
  '/tr',
  '/en',
  '/tr/kataloglar',
  '/en/catalogs',
  '/tr/projeler',
  '/en/projects',
  '/tr/referanslar',
  '/en/references',
  '/en/about',
  '/en/vision',
  '/en/services',
  '/tr/hakkimizda',
  '/tr/vizyon',
  '/tr/hizmetler',
  '/tr/iletisim',
  '/en/contact',
  '/tr/gizlilik',
  '/en/privacy',
  '/tr/kullanim-kosullari',
  '/en/terms',
  '/tr/urunler',
  '/en/products',
  '/tr/urunler/halka-sarkit-40w',
  '/en/products/halka-sarkit-40w',
];

// The sign-in page is public. The panel redirects a visitor without a session, so it is not listed.
export const ADMIN_PAGES: readonly string[] = ['/tr/yonetim/giris', '/en/admin/sign-in'];
