// Every public page the audit visits. A page template under src/app/[locale]/(site) without an address here fails
// pages.test.ts, so a new template can not ship unaudited.
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
