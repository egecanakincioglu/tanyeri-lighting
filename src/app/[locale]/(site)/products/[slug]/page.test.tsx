import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../../messages/tr.json' with { type: 'json' };
import type { Category, Product } from '../../../../../server/content/schemas.ts';
import { axeViolations } from '../../../../../test/axe.ts';
import { imageLoading } from '../../../../../test/image-loading.ts';
import ProductPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ categories: vi.fn(), product: vi.fn() }));

vi.mock('../../../../../server/content/categories.ts', () => ({ listCategories: content.categories }));
vi.mock('../../../../../server/content/products.ts', () => ({ getProductBySlug: content.product }));

// The real helper needs the Next.js server runtime.
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
const none = { tr: '', en: '' };
const categories: Category[] = [
  { id: 'c1', key: 'indoor', name: pair('Indoor'), seoTitle: none, seoDescription: none, h1: none, intro: none },
];
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
  description: { tr: '', en: '' },
  luminousFlux: '',
  colorTemperature: '',
  cri: '',
  ip: '',
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
      '/tr/urunler?category=indoor',
      '/tr/iletisim?product=spot-12w',
    ],
    [
      'en',
      ['Code', 'Category', 'Colour', 'Material', 'Power', 'Dimensions'],
      '/en/products',
      '/en/products?category=indoor',
      '/en/contact?product=spot-12w',
    ],
  ])('shows the name, photo, details and links in %s', async (locale, labels, all, list, contact) => {
    const l = locale.toUpperCase();
    const { container } = render(await ProductPage(props(locale)));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`Spot 12W ${l}`);
    expect(container.querySelector('h1 + p')?.textContent).toBe(`Indoor ${l} · SP-12`);
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
    ).toEqual([all, list, list, contact]);
  });

  it('links the category text to the category, and keeps the contact link out of the crawl', async () => {
    const { container } = render(await ProductPage(props('en')));
    const text = container.querySelector('h1 + p a')!;
    expect(text.textContent).toBe('Indoor EN');
    expect(text.getAttribute('href')).toBe('/en/products?category=indoor');
    expect(screen.getByRole('link', { name: 'Request information' }).getAttribute('rel')).toBe('nofollow');
  });

  it.each([
    ['tr', 'Sayfa yolu', 'Ürünler', '/tr/urunler', '/tr/urunler?category=indoor'],
    ['en', 'Breadcrumb', 'Products', '/en/products', '/en/products?category=indoor'],
  ])(
    'shows the trail to the product as real links in %s, with the page last',
    async (locale, label, list, all, cat) => {
      const l = locale.toUpperCase();
      render(await ProductPage(props(locale)));
      const trail = within(screen.getByRole('navigation', { name: label }));
      const items = trail.getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual([list, `Indoor ${l}`, `Spot 12W ${l}`]);
      expect(trail.getByRole('link', { name: list }).getAttribute('href')).toBe(all);
      expect(trail.getByRole('link', { name: `Indoor ${l}` }).getAttribute('href')).toBe(cat);
      expect(trail.getAllByRole('link')).toHaveLength(2);
      expect(items[2]!.querySelector('[aria-current="page"]')?.textContent).toBe(`Spot 12W ${l}`);
      expect(screen.queryByText(/Back to|kategorisine dön|All products|Tüm ürünler/)).toBeNull();
    },
  );

  it('goes back to the whole list when the category is unknown', async () => {
    content.categories.mockResolvedValue([]);
    const { container } = render(await ProductPage(props('en')));
    const trail = within(screen.getByRole('navigation', { name: 'Breadcrumb' }));
    expect(trail.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Products', 'Spot 12W EN']);
    expect(trail.getByRole('link', { name: 'Products' }).getAttribute('href')).toBe('/en/products');
    expect(container.querySelectorAll('p a')).toHaveLength(0);
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '');
    expect(data.itemListElement).toHaveLength(2);
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

  it.each([
    ['tr', ['Işık akısı', 'Renk sıcaklığı', 'CRI', 'Koruma sınıfı']],
    ['en', ['Luminous flux', 'Colour temperature', 'CRI', 'IP rating']],
  ])('shows the description and the technical rows in %s, after the other rows', async (locale, labels) => {
    content.product.mockResolvedValue({
      product: {
        ...product,
        description: { tr: 'Kısa açıklama.', en: 'Short description.' },
        luminousFlux: '1050 lm',
        colorTemperature: '3000 K',
        cri: 'Ra 90',
        ip: 'IP20',
      },
    });
    const { container } = render(await ProductPage(props(locale)));
    expect(container.querySelector('h1 + p + p')?.textContent).toBe(
      locale === 'tr' ? 'Kısa açıklama.' : 'Short description.',
    );
    expect([...container.querySelectorAll('dt')].map((dt) => dt.textContent).slice(-4)).toEqual(labels);
    expect([...container.querySelectorAll('dd')].map((dd) => dd.textContent).slice(-4)).toEqual([
      '1050 lm',
      '3000 K',
      'Ra 90',
      'IP20',
    ]);
  });

  it('adds no description paragraph and no technical rows when they are empty', async () => {
    const { container } = render(await ProductPage(props('en')));
    expect(container.querySelector('h1 + p + p')).toBeNull();
    expect(container.querySelectorAll('dt')).toHaveLength(6);
  });

  it('uses the description as the page description when there is one', async () => {
    content.product.mockResolvedValue({
      product: { ...product, description: { tr: 'Kısa açıklama.', en: 'Short description.' } },
    });
    expect((await generateMetadata(props('tr'))).description).toBe('Kısa açıklama.');
    expect((await generateMetadata(props('en'))).description).toBe('Short description.');
  });

  it('fetches the product photo at once and ahead of everything else', async () => {
    const { container } = render(await ProductPage(props('tr')));
    expect(imageLoading(container)).toEqual(['eager/high']);
  });

  it('puts the name and summary before the photo and has one h1', async () => {
    const { container } = render(await ProductPage(props('tr')));
    const h1 = container.querySelector('h1')!;
    const image = container.querySelector('img')!;
    expect(h1.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it.each([
    ['tr', 'Ürünler', 'https://example.test/tr/urunler/spot-12w', 'https://example.test/tr/urunler?category=indoor'],
    ['en', 'Products', 'https://example.test/en/products/spot-12w', 'https://example.test/en/products?category=indoor'],
  ])(
    'describes the trail to the product as structured data in %s, without a price',
    async (locale, list, url, categoryUrl) => {
      vi.stubEnv('SITE_URL', 'https://example.test');
      const { container } = render(await ProductPage(props(locale)));
      const scripts = container.querySelectorAll('script[type="application/ld+json"]');
      expect(scripts).toHaveLength(1);
      const data = JSON.parse(scripts[0]!.textContent ?? '');
      expect(data['@type']).toBe('BreadcrumbList');
      expect(data.itemListElement.map((item: { name: string }) => item.name)).toEqual([
        list,
        `Indoor ${locale.toUpperCase()}`,
        `Spot 12W ${locale.toUpperCase()}`,
      ]);
      expect(data.itemListElement[1].item).toBe(categoryUrl);
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
    [
      'tr',
      'Spot 12W TR: 12W, 10 x 10 cm, White TR, Aluminium TR. Ürün kodu SP-12; teknik bilgi talep edin. Demo ürün.',
    ],
    [
      'en',
      'Spot 12W EN: 12W, 10 x 10 cm, White EN, Aluminium EN. Product code SP-12; ask for technical details. Demo product.',
    ],
  ])('titles the product with its category and describes it from its details in %s', async (locale, description) => {
    const l = locale.toUpperCase();
    const metadata = await generateMetadata(props(locale));
    expect(metadata).toMatchObject({ title: `Spot 12W ${l} | Indoor ${l}`, description });
    expect(metadata.openGraph).toMatchObject({ type: 'website', locale: locale === 'tr' ? 'tr_TR' : 'en_US' });
  });

  it('leaves out the details that are empty, and the category when it is unknown', async () => {
    content.categories.mockResolvedValue([]);
    content.product.mockResolvedValue({
      product: { ...product, power: '', dimensions: '', color: { tr: '', en: '' }, material: pair('Aluminium') },
    });
    expect(await generateMetadata(props('en'))).toMatchObject({
      title: 'Spot 12W EN',
      description: 'Spot 12W EN: Aluminium EN. Product code SP-12; ask for technical details. Demo product.',
    });
    content.product.mockResolvedValue({
      product: { ...product, power: '', dimensions: '', color: { tr: '', en: '' }, material: { tr: '', en: '' } },
    });
    expect((await generateMetadata(props('en'))).description).toBe(
      'Spot 12W EN. Product code SP-12; ask for technical details. Demo product.',
    );
  });

  it('has no metadata for a missing product, a redirect or an unknown language', async () => {
    content.product.mockResolvedValue(null);
    await expect(generateMetadata(props('en', 'missing'))).resolves.toEqual({});
    content.product.mockResolvedValue({ redirectTo: 'new-slug' });
    await expect(generateMetadata(props('en', 'old'))).resolves.toEqual({});
    await expect(generateMetadata(props('fr'))).resolves.toEqual({});
  });
});
