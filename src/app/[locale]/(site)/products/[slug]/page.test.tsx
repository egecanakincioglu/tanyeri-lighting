import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../../messages/tr.json' with { type: 'json' };
import type { Category, Product } from '../../../../../server/content/schemas.ts';
import { axeViolations } from '../../../../../test/axe.ts';
import ProductPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ categories: vi.fn(), product: vi.fn() }));

vi.mock('../../../../../server/content/categories.ts', () => ({ listCategories: content.categories }));
vi.mock('../../../../../server/content/products.ts', () => ({ getProductBySlug: content.product }));

// The real helper needs the Next.js server runtime; this fake reads the same message files.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Product' | 'Header' }) =>
    Promise.resolve((key: string, values?: Record<string, string>) =>
      Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, value),
        ({ tr, en }[locale][namespace] as Record<string, string>)[key] ?? key,
      ),
    ),
}));

const pair = (text: string) => ({ tr: `${text} TR`, en: `${text} EN` });
const categories: Category[] = [{ id: 'c1', key: 'indoor', name: pair('Indoor') }];
const product: Product = {
  id: 'p1',
  categoryId: 'c1',
  categoryKey: 'indoor',
  slug: 'spot-12w',
  code: 'SP-12',
  name: pair('Spot 12W'),
  color: pair('White'),
  material: pair('Aluminium'),
  power: '12W',
  dimensions: '10 x 10 cm',
  imageUrl: '/demo/product-gomme-spot.webp',
};

const props = (locale: string, slug = 'spot-12w') =>
  ({ params: Promise.resolve({ locale, slug }) }) as PageProps<'/[locale]/products/[slug]'>;

describe('ProductPage', () => {
  beforeEach(() => {
    content.categories.mockResolvedValue(categories);
    content.product.mockResolvedValue({ product });
  });
  afterEach(() => {
    cleanup();
    content.categories.mockClear();
    content.product.mockClear();
  });

  it.each([
    [
      'tr',
      ['Ürün kodu', 'Kategori', 'Renk', 'Malzeme', 'Güç', 'Ölçüler'],
      '/tr/urunler',
      '/tr/iletisim?product=spot-12w',
    ],
    [
      'en',
      ['Code', 'Category', 'Colour', 'Material', 'Power', 'Dimensions'],
      '/en/products',
      '/en/contact?product=spot-12w',
    ],
  ])('shows the name, photo, details and links in %s', async (locale, labels, list, contact) => {
    const l = locale.toUpperCase();
    const { container } = render(await ProductPage(props(locale)));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`Spot 12W ${l}`);
    expect(screen.getByText(`Indoor ${l} · SP-12`)).toBeTruthy();
    expect(screen.getByRole('img', { name: `Spot 12W ${l}` }).getAttribute('sizes')).toBe('240px');
    expect([...container.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual(labels);
    expect([...container.querySelectorAll('dd')].map((dd) => dd.textContent)).toEqual([
      'SP-12',
      `Indoor ${l}`,
      `White ${l}`,
      `Aluminium ${l}`,
      '12W',
      '10 x 10 cm',
    ]);
    expect(
      within(container)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual([list, contact]);
  });

  it('leaves out a detail that has no value', async () => {
    content.product.mockResolvedValue({ product: { ...product, power: '', color: { tr: '', en: '' } } });
    const { container } = render(await ProductPage(props('en')));
    expect([...container.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      'Code',
      'Category',
      'Material',
      'Dimensions',
    ]);
  });

  it('puts the name and summary before the photo and has one h1', async () => {
    const { container } = render(await ProductPage(props('tr')));
    const h1 = container.querySelector('h1')!;
    const image = container.querySelector('img')!;
    expect(h1.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it.each([
    ['tr', 'Anasayfa', 'Ürünler', 'https://example.test/tr/urunler/spot-12w'],
    ['en', 'Home', 'Products', 'https://example.test/en/products/spot-12w'],
  ])(
    'describes the trail to the product as structured data in %s, without a price',
    async (locale, home, list, url) => {
      vi.stubEnv('SITE_URL', 'https://example.test');
      const { container } = render(await ProductPage(props(locale)));
      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts).toHaveLength(1);
      const data = JSON.parse(scripts[0]!.textContent ?? '');
      expect(data['@type']).toBe('BreadcrumbList');
      expect(data.itemListElement.map((item: { name: string }) => item.name)).toEqual([
        home,
        list,
        `Spot 12W ${locale.toUpperCase()}`,
      ]);
      expect(data.itemListElement[2].item).toBe(url);
      expect(JSON.stringify(data)).not.toMatch(/offers|price/i);
      vi.unstubAllEnvs();
    },
  );

  it('has no axe violations', async () => {
    const { container } = render(<main>{await ProductPage(props('tr'))}</main>);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('answers an old slug with a permanent redirect to the current address', async () => {
    content.product.mockResolvedValue({ redirectTo: 'new-slug' });
    await expect(ProductPage(props('tr', 'old-slug'))).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/tr/urunler/new-slug;308;',
    });
    await expect(ProductPage(props('en', 'old-slug'))).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/en/products/new-slug;308;',
    });
  });

  it('answers an unknown slug and an unknown language with not-found', async () => {
    content.product.mockResolvedValue(null);
    await expect(ProductPage(props('tr', 'missing'))).rejects.toThrow();
    await expect(ProductPage(props('fr'))).rejects.toThrow();
  });

  it.each([
    ['tr', 'Spot 12W TR, Indoor TR. Ürün kodu: SP-12.'],
    ['en', 'Spot 12W EN, Indoor EN. Product code: SP-12.'],
  ])('describes the product in %s', async (locale, description) => {
    const metadata = await generateMetadata(props(locale));
    expect(metadata).toMatchObject({ title: `Spot 12W ${locale.toUpperCase()}`, description });
  });

  it('has no metadata for a missing product, a redirect or an unknown language', async () => {
    content.product.mockResolvedValue(null);
    await expect(generateMetadata(props('en', 'missing'))).resolves.toEqual({});
    content.product.mockResolvedValue({ redirectTo: 'new-slug' });
    await expect(generateMetadata(props('en', 'old'))).resolves.toEqual({});
    await expect(generateMetadata(props('fr'))).resolves.toEqual({});
  });
});
