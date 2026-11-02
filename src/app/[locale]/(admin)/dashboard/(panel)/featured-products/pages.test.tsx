import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import FeaturedProductsAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listFeaturedProducts: vi.fn(), listProducts: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/featured-products.ts', () => ({
  listFeaturedProducts: mocks.listFeaturedProducts,
}));
vi.mock('../../../../../../server/content/products.ts', () => ({ listProducts: mocks.listProducts }));
vi.mock('../../../../../../server/admin/featured-actions.ts', () => ({ saveFeaturedProductsAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const product = (n: number) => ({
  id: `p${n}`,
  categoryKey: 'indoor',
  slug: `lamp-${n}`,
  code: `CODE-${n}`,
  name: { tr: `Lamba ${n}`, en: `Lamp ${n}` },
  color: { tr: 'Siyah', en: 'Black' },
  material: { tr: 'Alüminyum', en: 'Aluminium' },
  power: '12 W',
  dimensions: '10 mm',
  imageUrl: '/demo/area-otel.webp',
});

const props = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/featured-products'>;

const show = async (locale: 'tr' | 'en') =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await FeaturedProductsAdminPage(props(locale))}
    </NextIntlClientProvider>,
  );

describe('featured products screen', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listFeaturedProducts.mockClear();
    mocks.listFeaturedProducts.mockResolvedValue([product(2)]);
    mocks.listProducts.mockClear();
    mocks.listProducts.mockResolvedValue([product(1), product(2), product(3)]);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('lists the featured products in the language of the page and offers the others', async () => {
    await show('en');
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Featured Products');
    expect(screen.getByText(/Up to 6 products/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove: Lamp 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add a product: Lamp 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add a product: Lamp 2' })).toBeNull();
  });

  it('is Turkish at the Turkish address and stays out of search results', async () => {
    await show('tr');
    expect(screen.getByRole('button', { name: 'Kaldır: Lamba 2' })).toBeTruthy();
    expect(await generateMetadata(props('en'))).toMatchObject({ robots: { index: false, follow: false } });
  });

  it('turns the controls off in the demo', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    await show('en');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Remove: Lamp 2' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('refuses a visitor without a session and an unknown language', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(FeaturedProductsAdminPage(props('en'))).rejects.toThrow('redirect:');
    expect(mocks.listProducts).not.toHaveBeenCalled();
    await expect(FeaturedProductsAdminPage(props('xx'))).rejects.toThrow('not-found');
  });

  it('has no axe violations', async () => {
    const { container } = await show('en');
    expect(await axeViolations(container)).toEqual([]);
  });
});
