import type { Metadata } from 'next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const content = vi.hoisted(() => ({
  metadata: vi.fn(),
  legal: vi.fn(),
  product: vi.fn(),
  categories: vi.fn(),
  products: vi.fn(),
}));

vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../test/translations.ts')).getTranslations,
}));
vi.mock('../../../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));
vi.mock('../../../server/content/legal-pages.ts', () => ({ getLegalPage: content.legal }));
vi.mock('../../../server/content/products.ts', () => ({
  getProductBySlug: content.product,
  listProducts: content.products,
}));
vi.mock('../../../server/content/categories.ts', () => ({ listCategories: content.categories }));

type Locale = 'tr' | 'en';
type Page = { generateMetadata: (props: never) => Promise<Metadata> };

const props = (locale: string, extra: Record<string, string> = {}) =>
  ({ params: Promise.resolve({ locale, ...extra }), searchParams: Promise.resolve({}) }) as never;

const pages: [string, () => Promise<Page>, Record<Locale, string>, Record<Locale, string>][] = [
  ['home', () => import('./page.tsx'), { tr: '/tr', en: '/en' }, { tr: '/tr', en: '/en' }],
  [
    'about',
    () => import('./about/page.tsx'),
    { tr: '/tr/hakkimizda', en: '/en/about' },
    { tr: 'Hakkımızda', en: 'About us' },
  ],
  [
    'vision',
    () => import('./vision/page.tsx'),
    { tr: '/tr/vizyon', en: '/en/vision' },
    { tr: 'Vizyonumuz', en: 'Our vision' },
  ],
  [
    'services',
    () => import('./services/page.tsx'),
    { tr: '/tr/hizmetler', en: '/en/services' },
    { tr: 'Hizmetler', en: 'Services' },
  ],
  [
    'projects',
    () => import('./projects/page.tsx'),
    { tr: '/tr/projeler', en: '/en/projects' },
    { tr: 'Projeler', en: 'Projects' },
  ],
  [
    'references',
    () => import('./references/page.tsx'),
    { tr: '/tr/referanslar', en: '/en/references' },
    { tr: 'Referanslarımız', en: 'References' },
  ],
  [
    'catalogs',
    () => import('./catalogs/page.tsx'),
    { tr: '/tr/kataloglar', en: '/en/catalogs' },
    { tr: 'Kataloglar', en: 'Catalogs' },
  ],
  [
    'products',
    () => import('./products/page.tsx'),
    { tr: '/tr/urunler', en: '/en/products' },
    { tr: 'Ürünler', en: 'Products' },
  ],
  [
    'contact',
    () => import('./contact/page.tsx'),
    { tr: '/tr/iletisim', en: '/en/contact' },
    { tr: 'İletişim', en: 'Contact' },
  ],
  [
    'privacy',
    () => import('./privacy/page.tsx'),
    { tr: '/tr/gizlilik', en: '/en/privacy' },
    { tr: 'Gizlilik', en: 'Privacy' },
  ],
  [
    'terms',
    () => import('./terms/page.tsx'),
    { tr: '/tr/kullanim-kosullari', en: '/en/terms' },
    { tr: 'Koşullar', en: 'Terms' },
  ],
];

describe('page metadata', () => {
  beforeEach(() => {
    content.metadata.mockResolvedValue(null);
    content.legal.mockResolvedValue(null);
    content.categories.mockResolvedValue([]);
    content.products.mockResolvedValue([{ id: 'p1' }]);
  });
  afterEach(() => {
    content.metadata.mockReset();
    content.legal.mockReset();
    content.product.mockReset();
    content.categories.mockReset();
    content.products.mockReset();
  });

  describe.each(pages)('%s', (key, load, paths) => {
    it.each(['tr', 'en'] as const)('has a canonical and the full alternate set in %s', async (locale) => {
      const { generateMetadata } = await load();
      const metadata = await generateMetadata(props(locale));
      expect(metadata.alternates?.canonical).toBe(paths[locale]);
      expect(metadata.openGraph).toMatchObject({ url: paths[locale], siteName: 'Tanyeri Lighting' });
      expect(metadata.alternates?.languages).toEqual({
        tr: paths.tr,
        en: paths.en,
        'x-default': key === 'home' ? '/' : paths.tr,
      });
    });

    it('keeps the saved description and leaves it out when there is none', async () => {
      const { generateMetadata } = await load();
      content.metadata.mockResolvedValue({
        title: { tr: 'T', en: 'T' },
        description: { tr: 'Açıklama', en: 'Description' },
        updatedAt: new Date(),
      });
      content.legal.mockResolvedValue({
        title: { tr: 'Başlık', en: 'Title' },
        body: { tr: 'g', en: 'b' },
        updatedAt: new Date(),
      });
      expect((await generateMetadata(props('en'))).description).toBe('Description');
      expect((await generateMetadata(props('tr'))).description).toBe('Açıklama');
      content.metadata.mockResolvedValue(null);
      expect(await generateMetadata(props('en'))).not.toHaveProperty('description');
    });
  });

  it.each(pages.filter(([key]) => !['home', 'contact', 'privacy', 'terms'].includes(key)))(
    '%s shows the saved title, and the menu name before one is saved',
    async (_key, load, _paths, titles) => {
      const { generateMetadata } = await load();
      expect((await generateMetadata(props('tr'))).title).toBe(titles.tr);
      expect((await generateMetadata(props('en'))).title).toBe(titles.en);
      content.metadata.mockResolvedValue({
        title: { tr: 'Kayıtlı', en: 'Saved' },
        description: { tr: '', en: '' },
        updatedAt: new Date(),
      });
      expect((await generateMetadata(props('tr'))).title).toBe('Kayıtlı');
      expect((await generateMetadata(props('en'))).title).toBe('Saved');
    },
  );

  it('gives a legal page the title of its own content, and none before it is saved', async () => {
    const { generateMetadata } = await import('./privacy/page.tsx');
    content.legal.mockResolvedValue({
      title: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
      body: { tr: '', en: '' },
      updatedAt: new Date(),
    });
    expect((await generateMetadata(props('en'))).title).toBe('Privacy Policy');
    content.legal.mockResolvedValue(null);
    expect(await generateMetadata(props('en'))).not.toHaveProperty('title');
  });

  it('gives a page of an unknown language no alternates for the home page', async () => {
    const { generateMetadata } = await import('./page.tsx');
    await expect(generateMetadata(props('fr'))).resolves.toEqual({});
  });

  describe('product page', () => {
    const product = {
      id: 'p1',
      categoryId: 'c1',
      categoryKey: 'indoor',
      slug: 'spot-12w',
      code: 'SP-12',
      name: { tr: 'Spot TR', en: 'Spot EN' },
      color: { tr: '', en: '' },
      material: { tr: '', en: '' },
      power: '',
      dimensions: '',
      description: { tr: '', en: '' },
    };

    it.each([
      ['tr', '/tr/urunler/spot-12w'],
      ['en', '/en/products/spot-12w'],
    ])('points the canonical at the product address in %s', async (locale, canonical) => {
      content.categories.mockResolvedValue([{ id: 'c1', key: 'indoor', name: { tr: 'İç', en: 'In' } }]);
      content.product.mockResolvedValue({ product });
      const { generateMetadata } = await import('./products/[slug]/page.tsx');
      const metadata = await generateMetadata(props(locale, { slug: 'spot-12w' }));
      expect(metadata.alternates).toEqual({
        canonical,
        languages: { tr: '/tr/urunler/spot-12w', en: '/en/products/spot-12w', 'x-default': '/tr/urunler/spot-12w' },
      });
    });

    it('uses the current slug even when asked by an old one', async () => {
      content.categories.mockResolvedValue([]);
      content.product.mockResolvedValue({ product });
      const { generateMetadata } = await import('./products/[slug]/page.tsx');
      const metadata = await generateMetadata(props('en', { slug: 'old-slug' }));
      expect(metadata.alternates?.canonical).toBe('/en/products/spot-12w');
    });

    it('has no alternates for a missing product or a redirect', async () => {
      const { generateMetadata } = await import('./products/[slug]/page.tsx');
      content.product.mockResolvedValue(null);
      await expect(generateMetadata(props('en', { slug: 'x' }))).resolves.toEqual({});
      content.product.mockResolvedValue({ redirectTo: 'y' });
      await expect(generateMetadata(props('en', { slug: 'x' }))).resolves.toEqual({});
    });
  });
});
