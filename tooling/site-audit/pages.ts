// Every public page the audit visits. A page template under src/app/[locale]/(site) without an address here fails
// pages.test.ts, so a new template can not ship unaudited.
//
// Admin screens are listed apart (SIGN_IN_PAGES, ADMIN_PAGES). They are noindex by design, so Lighthouse would score
// their SEO below the gate; they get the browser checks (accessibility, overflow, console, status) but no Lighthouse run.
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

// The sign-in pages are public and checked signed out. The panel redirects a visitor without a session, so its screens
// are listed apart, in ADMIN_PAGES, and visited with the demo admin's session.
export const SIGN_IN_PAGES: readonly string[] = ['/tr/yonetim/giris', '/en/admin/sign-in'];

// Every panel screen without a parameter in its address. The edit screens take a record id, which the seeded content
// does not fix, so their components are covered by unit tests and the browser walkthrough instead.
export const ADMIN_PAGES: readonly string[] = [
  '/tr/yonetim',
  '/en/admin',
  '/tr/yonetim/referanslar',
  '/en/admin/references',
  '/tr/yonetim/referanslar/yeni',
  '/en/admin/references/new',
  '/tr/yonetim/mesajlar',
  '/en/admin/messages',
  '/tr/yonetim/yasal-sayfalar',
  '/en/admin/legal-pages',
  '/tr/yonetim/sayfa-bilgileri',
  '/en/admin/seo',
  '/tr/yonetim/hesabim',
  '/en/admin/account',
  '/tr/yonetim/urunler',
  '/en/admin/products',
  '/tr/yonetim/urunler/yeni',
  '/en/admin/products/new',
  '/tr/yonetim/kategoriler',
  '/en/admin/categories',
  '/tr/yonetim/kategoriler/yeni',
  '/en/admin/categories/new',
  '/tr/yonetim/kataloglar',
  '/en/admin/catalogs',
  '/tr/yonetim/kataloglar/yeni',
  '/en/admin/catalogs/new',
  '/tr/yonetim/banner',
  '/en/admin/banner',
  '/tr/yonetim/one-cikan-urunler',
  '/en/admin/featured-products',
  '/tr/yonetim/tanitim-panolari',
  '/en/admin/promo-boards',
  '/tr/yonetim/tanitim-panolari/yeni',
  '/en/admin/promo-boards/new',
  '/tr/yonetim/calisma-alanlari',
  '/en/admin/application-areas',
  '/tr/yonetim/calisma-alanlari/yeni',
  '/en/admin/application-areas/new',
  '/tr/yonetim/hizmetler',
  '/en/admin/services',
  '/tr/yonetim/hizmetler/yeni',
  '/en/admin/services/new',
  '/tr/yonetim/projeler',
  '/en/admin/projects',
  '/tr/yonetim/projeler/yeni',
  '/en/admin/projects/new',
  '/tr/yonetim/kurumsal-ayarlar',
  '/en/admin/settings',
  '/tr/yonetim/hakkimizda',
  '/en/admin/about',
];
