import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditProductPage from './[id]/page.tsx';
import NewProductPage from './new/page.tsx';
import ProductsAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({
  guardPage: vi.fn(),
  listCategories: vi.fn(),
  listProducts: vi.fn(),
  listFeaturedProducts: vi.fn(),
}));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/categories.ts', () => ({ listCategories: mocks.listCategories }));
vi.mock('../../../../../../server/content/products.ts', () => ({ listProducts: mocks.listProducts }));
vi.mock('../../../../../../server/content/featured-products.ts', () => ({
  listFeaturedProducts: mocks.listFeaturedProducts,
}));
vi.mock('../../../../../../server/admin/products-actions.ts', () => ({
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
  deleteProductAction: vi.fn(),
  reorderProductsAction: vi.fn(),
}));
vi.mock('../../../../../../server/admin/upload-actions.ts', () => ({ uploadMediaAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const categories = [
  { id: 'c1', key: 'indoor', name: { tr: 'İç mekan', en: 'Indoor' } },
  { id: 'c2', key: 'outdoor', name: { tr: 'Dış mekan', en: 'Outdoor' } },
];

function product(index: number, categoryIndex = 0) {
  const pair = { tr: 'x', en: 'x' };
  return {
    id: `p${index}`,
    categoryId: categories[categoryIndex]!.id,
    categoryKey: categories[categoryIndex]!.key,
    slug: `lamp-${index}`,
    code: `L-${index}`,
    name: { tr: `Lamba ${index}`, en: `Lamp ${index}` },
    color: pair,
    material: pair,
    power: '10 W',
    dimensions: '10 cm',
    imageUrl: '/demo/area-otel.webp',
  };
}

// 30 products in the first category (two pages) and 2 in the second.
const everything = [...Array.from({ length: 30 }, (_, index) => product(index + 1)), product(31, 1), product(32, 1)];

type Query = Record<string, string | string[] | undefined>;
const listProps = (locale: string, query: Query = {}) =>
  ({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve(query),
  }) as PageProps<'/[locale]/dashboard/products'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/products/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/products/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

const editLinks = () => screen.getAllByRole('link', { name: /^Edit: / });

describe('product screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listCategories.mockClear();
    mocks.listCategories.mockResolvedValue(categories);
    mocks.listProducts.mockClear();
    mocks.listProducts.mockResolvedValue(everything);
    mocks.listFeaturedProducts.mockClear();
    mocks.listFeaturedProducts.mockResolvedValue([everything[1]]);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows 24 products with code and category, a link to create one, and the page count', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Products');
      expect(screen.getByRole('link', { name: 'New product' }).getAttribute('href')).toBe('/en/admin/products/new');
      expect(editLinks()).toHaveLength(24);
      expect(screen.getByText('L-1 · Indoor')).toBeTruthy();
      expect(screen.getByText('Page 1 of 2')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Next page' }).getAttribute('href')).toBe('/en/admin/products?page=2');
      expect(screen.queryByRole('link', { name: 'Previous page' })).toBeNull();
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await ProductsAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni ürün' }).getAttribute('href')).toBe('/tr/yonetim/urunler/yeni');
      expect(screen.getByText('Sayfa 1 / 2')).toBeTruthy();
    });

    it('shows the second page, and clamps a page past the end', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en', { page: '2' })));
      expect(editLinks()).toHaveLength(8);
      expect(screen.getByRole('link', { name: 'Previous page' }).getAttribute('href')).toBe('/en/admin/products');
      cleanup();
      inIntl('en', await ProductsAdminPage(listProps('en', { page: '99' })));
      expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    });

    it('falls back to the first page and all products for malformed query values', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en', { page: 'abc', category: 'nope', q: ['', 'x'] })));
      expect(editLinks()).toHaveLength(24);
      expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    });

    it('searches by name or code and keeps the search in the links', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en', { q: 'lamp 3' })));
      expect(editLinks().map((link) => link.getAttribute('aria-label'))).toEqual([
        'Edit: Lamp 3',
        'Edit: Lamp 30',
        'Edit: Lamp 31',
        'Edit: Lamp 32',
      ]);
      cleanup();
      inIntl('en', await ProductsAdminPage(listProps('en', { q: 'l-2' })));
      expect(editLinks()).toHaveLength(11);
      expect(screen.getByRole('link', { name: 'Clear' })).toBeTruthy();
      expect((screen.getByLabelText('Search by name or code') as HTMLInputElement).value).toBe('l-2');
    });

    it('says when the search matches nothing', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en', { q: 'zzz' })));
      expect(screen.getByText('No product matches this search.')).toBeTruthy();
    });

    it('filters by category, and then offers the arrows for the whole category', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en', { category: 'indoor' })));
      expect(editLinks()).toHaveLength(30);
      expect(screen.queryByText(/Page 1 of/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Move up: Lamp 2' })).toBeTruthy();
      expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('indoor');
    });

    it('has no arrows while all categories are shown or a search is active', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en')));
      expect(screen.queryByRole('button', { name: /^Move up/ })).toBeNull();
      expect(screen.getByText(/arrows work when one category is shown/)).toBeTruthy();
      cleanup();
      inIntl('en', await ProductsAdminPage(listProps('en', { category: 'outdoor', q: 'lamp' })));
      expect(screen.queryByRole('button', { name: /^Move up/ })).toBeNull();
    });

    it('tells in the confirm dialog that deleting a featured product also removes it from the home page', async () => {
      inIntl('en', await ProductsAdminPage(listProps('en')));
      expect(document.body.textContent).toContain(
        '“Lamp 2” will be deleted for good. It is also featured on the home page',
      );
      expect(document.body.textContent).toContain('“Lamp 1” will be deleted for good. This can not be undone.');
    });

    it('asks for a category first when there is none', async () => {
      mocks.listCategories.mockResolvedValue([]);
      mocks.listProducts.mockResolvedValue([]);
      inIntl('en', await ProductsAdminPage(listProps('en')));
      expect(screen.getByText(/Add a category first/)).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'New product' })).toBeNull();
    });

    it('says so when there are no products yet', async () => {
      mocks.listProducts.mockResolvedValue([]);
      inIntl('en', await ProductsAdminPage(listProps('en')));
      expect(screen.getByText('There are no products yet. Add the first one.')).toBeTruthy();
    });

    it('turns reordering and deleting off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await ProductsAdminPage(listProps('en', { category: 'outdoor' })));
      expect((screen.getByRole('button', { name: 'Delete: Lamp 31' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(ProductsAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listProducts).not.toHaveBeenCalled();
      await expect(ProductsAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await ProductsAdminPage(listProps('en', { category: 'outdoor' })));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form with the categories to choose from', async () => {
      inIntl('en', await NewProductPage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New product');
      expect((screen.getByLabelText('Product code') as HTMLInputElement).value).toBe('');
      expect(
        Array.from((screen.getByLabelText('Category') as HTMLSelectElement).options).map((option) => option.text),
      ).toEqual(['Indoor', 'Outdoor']);
      expect(screen.queryByText(/old address keeps working/)).toBeNull();
    });

    it('fills in the address from the Turkish name until the address is edited by hand', async () => {
      inIntl('en', await NewProductPage(newProps('en')));
      const slug = screen.getByLabelText('Address of the product page') as HTMLInputElement;
      const turkish = screen.getByLabelText('Turkish', { selector: '#name-tr' });
      await act(async () => {
        fireEvent.input(turkish, { target: { value: 'Şık Avize' } });
      });
      expect(slug.value).toBe('sik-avize');
      await act(async () => {
        fireEvent.change(slug, { target: { value: 'my-own' } });
      });
      await act(async () => {
        fireEvent.input(turkish, { target: { value: 'Başka Ad' } });
      });
      expect(slug.value).toBe('my-own');
    });

    it('turns saving off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewProductPage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('is not found when there is no category, and refuses a visitor without a session', async () => {
      mocks.listCategories.mockResolvedValue([]);
      await expect(NewProductPage(newProps('en'))).rejects.toThrow('not-found');
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewProductPage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewProductPage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored product and keeps the stored address', async () => {
      inIntl('en', await EditProductPage(editProps('en', 'p31')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit product');
      expect((screen.getByLabelText('Product code') as HTMLInputElement).value).toBe('L-31');
      expect((screen.getByLabelText('Category') as HTMLSelectElement).value).toBe('c2');
      const slug = screen.getByLabelText('Address of the product page') as HTMLInputElement;
      expect(slug.value).toBe('lamp-31');
      expect(screen.getByText(/old address keeps working and leads to the new one/)).toBeTruthy();
    });

    it('does not rewrite the stored address when the name is edited', async () => {
      inIntl('en', await EditProductPage(editProps('en', 'p31')));
      await act(async () => {
        fireEvent.input(screen.getByLabelText('Turkish', { selector: '#name-tr' }), { target: { value: 'Yeni' } });
      });
      expect((screen.getByLabelText('Address of the product page') as HTMLInputElement).value).toBe('lamp-31');
    });

    it('answers an id that does not exist with not found', async () => {
      await expect(EditProductPage(editProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditProductPage(editProps('en', 'p1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditProductPage(editProps('xx', 'p1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditProductPage(editProps('en', 'p1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
