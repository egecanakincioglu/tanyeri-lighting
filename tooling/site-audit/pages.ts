// Every public page the audit visits. A page template under src/app/[locale]/(site) without an address here fails
// pages.test.ts, so a new template can not ship unaudited.
export const LOCALES = ['tr', 'en'] as const;

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
];
