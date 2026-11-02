import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../messages/tr.json' with { type: 'json' };
import type { Category, Product } from '../../../../server/content/schemas.ts';
import { axeViolations } from '../../../../test/axe.ts';
import { imageLoading } from '../../../../test/image-loading.ts';
import ProductsPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ categories: vi.fn(), products: vi.fn(), metadata: vi.fn() }));

vi.mock('../../../../server/content/categories.ts', () => ({ listCategories: content.categories }));
vi.mock('../../../../server/content/products.ts', () => ({ listProducts: content.products }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));

// The real helper needs the Next.js server runtime; this fake reads the same message files.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Products' | 'Header' }) =>
    Promise.resolve((key: string, values: Record<string, number> = {}) =>
      Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        ({ tr, en }[locale][namespace] as Record<string, string>)[key]!,
      ),
    ),
}));

const pair = (text: string) => ({ tr: `${text} TR`, en: `${text} EN` });

const categories: Category[] = [
  { id: 'c1', key: 'indoor', name: pair('Indoor') },
  { id: 'c2', key: 'outdoor', name: pair('Outdoor') },
];

function makeProducts(count: number, categoryKey: string): Product[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${categoryKey}-${index + 1}`,
    categoryId: categoryKey === 'indoor' ? 'c1' : 'c2',
    categoryKey,
    slug: `${categoryKey}-lamp-${index + 1}`,
    code: `${categoryKey}-${index + 1}`,
    name: pair(`Lamp ${categoryKey} ${index + 1}`),
    color: pair('White'),
    material: pair('Aluminium'),
    power: '12W',
    dimensions: '10 x 10 cm',
    imageUrl: '/demo/product-gomme-spot.webp',
  }));
}

const indoor = makeProducts(26, 'indoor');
const outdoor = makeProducts(3, 'outdoor');

type Query = Record<string, string | string[] | undefined>;

const props = (locale: string, query: Query = {}) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }) as PageProps<'/[locale]/products'>;

async function renderPage(locale: string, query: Query = {}) {
  return render(await ProductsPage(props(locale, query)));
}

const productLinks = () => screen.getAllByRole('link', { name: /^Lamp / });

describe('ProductsPage', () => {
  beforeEach(() => {
    content.categories.mockResolvedValue(categories);
    content.products.mockImplementation((key?: string) => {
      if (key === undefined) return Promise.resolve([...indoor, ...outdoor]);
      return Promise.resolve(key === 'outdoor' ? outdoor : key === 'indoor' ? indoor : []);
    });
  });
  afterEach(() => {
    cleanup();
    content.categories.mockClear();
    content.products.mockClear();
    content.metadata.mockClear();
  });

  it.each([
    ['tr', 'Ürünlerimiz', 'Tümü', '/tr/urunler', '/tr/urunler/indoor-lamp-1'],
    ['en', 'Our products', 'All', '/en/products', '/en/products/indoor-lamp-1'],
  ])('shows the title, the tabs and the first 24 products in %s', async (locale, title, all, list, first) => {
    await renderPage(locale);
    const l = locale.toUpperCase();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    const tabs = within(screen.getAllByRole('navigation')[0]!).getAllByRole('link');
    expect(tabs.map((tab) => tab.textContent)).toEqual([all, `Indoor ${l}`, `Outdoor ${l}`]);
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([
      list,
      `${list}?category=indoor`,
      `${list}?category=outdoor`,
    ]);
    expect(tabs[0]?.getAttribute('aria-current')).toBe('page');
    expect(tabs[1]?.getAttribute('aria-current')).toBeNull();
    expect(productLinks()).toHaveLength(24);
    expect(screen.getByRole('link', { name: `Lamp indoor 1 ${l}` }).getAttribute('href')).toBe(first);
    expect(content.products).toHaveBeenCalledWith(undefined);
  });

  it('filters by category and marks the tab', async () => {
    await renderPage('en', { category: 'outdoor' });
    expect(content.products).toHaveBeenCalledWith('outdoor');
    expect(productLinks()).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Outdoor EN' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'All' }).getAttribute('aria-current')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
  });

  it('paginates by 24 and keeps the category in the page links', async () => {
    await renderPage('en', { category: 'indoor', page: '2' });
    expect(productLinks()).toHaveLength(2);
    const pages = within(screen.getByRole('navigation', { name: 'Pages' })).getAllByRole('link');
    expect(pages.map((link) => link.textContent)).toEqual(['Previous', '1', '2']);
    expect(pages.map((link) => link.getAttribute('href'))).toEqual([
      '/en/products?category=indoor',
      '/en/products?category=indoor',
      '/en/products?category=indoor&page=2',
    ]);
    expect(pages[2]?.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Lamp indoor 25 EN' })).toBeTruthy();
  });

  it.each([
    ['tr', '1', ['1', '2', '3', 'Sonraki']],
    ['en', '2', ['Previous', '1', '2', '3', 'Next']],
    ['en', '3', ['Previous', '1', '2', '3']],
  ])('adds previous and next only where they lead somewhere (%s, page %s)', async (locale, page, labels) => {
    content.products.mockResolvedValue(makeProducts(60, 'indoor'));
    await renderPage(locale, { page });
    const nav = screen.getByRole('navigation', { name: locale === 'tr' ? 'Sayfalar' : 'Pages' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(labels);
    const step = links.find((link) => link.textContent === 'Next' || link.textContent === 'Sonraki');
    if (step) expect(step.getAttribute('href')).toContain(`page=${Number(page) + 1}`);
  });

  it.each([['0'], ['3'], ['-1'], ['abc'], ['1.5'], ['99999999999']])(
    'falls back to the first page for page=%s',
    async (page) => {
      await renderPage('en', { page });
      expect(productLinks()).toHaveLength(24);
      expect(screen.getByRole('link', { name: '1' }).getAttribute('aria-current')).toBe('page');
    },
  );

  it('falls back to all products for an unknown or repeated category and page', async () => {
    await renderPage('en', { category: ['indoor', 'outdoor'], page: ['2', '1'] });
    expect(content.products).toHaveBeenCalledWith(undefined);
    expect(productLinks()).toHaveLength(24);
    cleanup();
    await renderPage('en', { category: 'missing' });
    expect(content.products).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByRole('link', { name: 'All' }).getAttribute('aria-current')).toBe('page');
  });

  it('says so when there are no products', async () => {
    content.categories.mockResolvedValue([]);
    content.products.mockResolvedValue([]);
    await renderPage('tr');
    expect(screen.getByText('Bu kategoride henüz ürün yok.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Sayfalar' })).toBeNull();
  });

  it('has one h1, one photo fetched at once, the rest lazy, and no axe violations', async () => {
    const { container } = render(<main>{await ProductsPage(props('tr'))}</main>);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const photos = [...container.querySelectorAll('img')];
    expect(photos).toHaveLength(24);
    expect(imageLoading(container)).toEqual(['eager/high', ...Array<string>(23).fill('lazy/null')]);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('answers an unknown language with not-found', async () => {
    await expect(ProductsPage(props('fr'))).rejects.toThrow();
  });

  it.each([
    ['tr', 'T TR', 'Description TR'],
    ['en', 'T EN', 'Description EN'],
  ])('titles the page with the saved title and describes it in %s', async (locale, title, description) => {
    content.metadata.mockResolvedValue({ title: pair('T'), description: pair('Description'), updatedAt: new Date() });
    await expect(generateMetadata(props(locale))).resolves.toMatchObject({ title, description });
  });

  it.each([
    ['tr', 'T TR - Sayfa 2', '/tr/urunler?page=2', '/en/products?page=2'],
    ['en', 'T EN - Page 2', '/en/products?page=2', '/tr/urunler?page=2'],
  ])('gives a later page its own canonical and title suffix in %s', async (locale, title, canonical, other) => {
    content.metadata.mockResolvedValue({ title: pair('T'), description: pair('Description'), updatedAt: new Date() });
    const metadata = await generateMetadata(props(locale, { page: '2' }));
    expect(metadata.title).toBe(title);
    expect(metadata.alternates?.canonical).toBe(canonical);
    expect(Object.values(metadata.alternates?.languages ?? {})).toContain(other);
    expect(metadata.alternates?.languages).toMatchObject({ 'x-default': '/tr/urunler?page=2' });
  });

  it('keeps the category in the canonical of a later page of that category', async () => {
    content.metadata.mockResolvedValue(null);
    const metadata = await generateMetadata(props('en', { category: 'indoor', page: '2' }));
    expect(metadata.title).toBe('Products - Page 2');
    expect(metadata.alternates?.canonical).toBe('/en/products?category=indoor&page=2');
  });

  it.each([
    ['a page beyond the last', { page: '9' }],
    ['a value that is not a number', { page: 'x' }],
  ])('treats %s as the first page', async (_name, query) => {
    content.metadata.mockResolvedValue(null);
    const metadata = await generateMetadata(props('en', query));
    expect(metadata.title).toBe('Products');
    expect(metadata.alternates?.canonical).toBe('/en/products');
  });

  it('keeps an empty list out of the index and a filled one in', async () => {
    expect(await generateMetadata(props('en'))).not.toHaveProperty('robots');
    content.products.mockResolvedValue([]);
    expect(await generateMetadata(props('en', { category: 'outdoor' }))).toMatchObject({
      robots: { index: false, follow: true },
    });
  });

  it('omits the description when none is saved, and returns nothing for an unknown language', async () => {
    content.metadata.mockResolvedValue(null);
    const metadata = await generateMetadata(props('en'));
    expect(metadata.title).toBe('Products');
    expect(metadata).not.toHaveProperty('description');
    expect(metadata.alternates?.canonical).toBe('/en/products');
    await expect(generateMetadata(props('fr'))).resolves.toEqual({});
  });
});
