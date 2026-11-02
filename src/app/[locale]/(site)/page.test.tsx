import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../messages/tr.json' with { type: 'json' };
import type {
  ApplicationArea,
  HomeBanner,
  Product,
  PromoBoard,
  SiteSettings,
} from '../../../server/content/schemas.ts';
import { axeViolations } from '../../../test/axe.ts';
import HomePage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({
  banner: vi.fn(),
  boards: vi.fn(),
  products: vi.fn(),
  areas: vi.fn(),
  metadata: vi.fn(),
  settings: vi.fn(),
  links: vi.fn(),
}));

vi.mock('../../../server/content/home-banner.ts', () => ({ getHomeBanner: content.banner }));
vi.mock('../../../server/content/promo-boards.ts', () => ({ listPromoBoards: content.boards }));
vi.mock('../../../server/content/featured-products.ts', () => ({ listFeaturedProducts: content.products }));
vi.mock('../../../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));
vi.mock('../../../server/content/site-settings.ts', () => ({ getSiteSettings: content.settings }));
vi.mock('../../../server/content/social-links.ts', () => ({ listSocialLinks: content.links }));
vi.mock('../../../server/content/application-areas.ts', () => ({ listApplicationAreas: content.areas }));

// The real helper needs the Next.js server runtime; this fake reads the same message files.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Home' | 'DemoBand' }) =>
    Promise.resolve((key: string) => (({ tr, en })[locale][namespace] as Record<string, string>)[key]),
}));

const pair = (text: string) => ({ tr: `${text} TR`, en: `${text} EN` });
const none = { tr: '', en: '' };

const banner: HomeBanner = {
  imageUrl: '/demo/banner.webp',
  title: pair('Banner title'),
  description: pair('Banner text'),
  primaryAction: { label: pair('Products'), target: 'products' },
  secondaryAction: { label: pair('Contact'), target: 'contact' },
};
const emptyBanner: HomeBanner = {
  imageUrl: '',
  title: none,
  description: none,
  primaryAction: { label: none, target: 'products' },
  secondaryAction: { label: none, target: 'contact' },
};
const boards: PromoBoard[] = [1, 2, 3].map((n) => ({
  id: `board-${n}`,
  imageUrl: '/demo/promo-dekoratif.webp',
  title: pair(`Board ${n}`),
  subtitle: n === 1 ? pair('Line 1') : { tr: '', en: '' },
  catalogId: 'catalog-1',
  catalogName: pair('Catalog'),
  catalogPdfUrl: '/demo/catalog-2026.pdf',
}));
const products = [1, 2].map((n) => ({
  id: `product-${n}`,
  categoryKey: 'indoor',
  categoryId: 'category-1',
  slug: `lamp-${n}`,
  code: `L${n}`,
  name: pair(`Lamp ${n}`),
  color: pair('White'),
  material: pair('Aluminium'),
  power: '12W',
  dimensions: '10 x 10 cm',
  imageUrl: '/demo/product-gomme-spot.webp',
})) satisfies Product[];
const areas: ApplicationArea[] = [1, 2].map((n) => ({
  id: `area-${n}`,
  imageUrl: '/demo/area-konut.webp',
  title: pair(`Area ${n}`),
  description: pair(`Area text ${n}`),
}));

const settings: SiteSettings = {
  siteName: pair('Brand'),
  logoUrl: null,
  phone: '+90 212 000 00 00',
  email: 'info@example.test',
  address: pair('Address'),
  workingHours: pair('Hours'),
  serviceArea: pair('Area'),
  languages: pair('Languages'),
};

// Addresses are localized: the Turkish ones differ from the route keys.
const PATHS = {
  tr: { products: '/tr/urunler', contact: '/tr/iletisim', catalogs: '/tr/kataloglar', product: '/tr/urunler/lamp-2' },
  en: { products: '/en/products', contact: '/en/contact', catalogs: '/en/catalogs', product: '/en/products/lamp-2' },
};

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]'>;

async function renderPage(locale: string) {
  return render(await HomePage(props(locale)));
}

describe('HomePage', () => {
  beforeEach(() => {
    content.banner.mockResolvedValue(banner);
    content.boards.mockResolvedValue(boards);
    content.products.mockResolvedValue(products);
    content.areas.mockResolvedValue(areas);
    content.settings.mockResolvedValue(settings);
    content.links.mockResolvedValue([
      { id: 'l1', platform: 'instagram', label: pair('Instagram'), url: 'https://instagram.example/tanyeri' },
    ]);
    vi.stubEnv('SITE_URL', 'https://example.test');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it.each([
    ['tr', 'Favori Ürünlerimiz', 'Çalışma Alanlarımız', 'Hemen İncele'],
    ['en', 'Our Favorite Products', 'Our Work Areas', 'Explore now'],
  ])('renders the banner, highlights and work areas in %s', async (locale, highlights, work, cta) => {
    const paths = locale === 'tr' ? PATHS.tr : PATHS.en;
    await renderPage(locale);
    const l = locale.toUpperCase();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`Banner title ${l}`);
    expect(screen.getByText(`Banner text ${l}`)).toBeTruthy();
    expect(screen.getByRole('link', { name: `Products ${l}` }).getAttribute('href')).toBe(paths.products);
    expect(screen.getByRole('link', { name: `Contact ${l}` }).getAttribute('href')).toBe(paths.contact);

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([highlights, work]);
    const boardLinks = screen.getAllByRole('link', { name: new RegExp(`^${cta}`) });
    expect(boardLinks).toHaveLength(3);
    expect(boardLinks.every((a) => a.getAttribute('href') === paths.catalogs)).toBe(true);
    expect(boardLinks[0]?.textContent).toContain(`Board 1 ${l}`);
    expect(screen.getByText(`Line 1 ${l}`)).toBeTruthy();
    expect(boardLinks[1]?.closest('article')?.querySelector('p')).toBeNull();
    expect(screen.getByRole('link', { name: `Lamp 2 ${l}` }).getAttribute('href')).toBe(paths.product);
    expect(screen.getByRole('heading', { level: 3, name: `Area 1 ${l}` })).toBeTruthy();
    expect(screen.getByText(`Area text 2 ${l}`)).toBeTruthy();
  });

  it('keeps the heading order and loads only the banner photo with priority', async () => {
    const { container } = await renderPage('tr');
    const levels = [...container.querySelectorAll('h1, h2, h3')].map((h) => h.tagName);
    expect(levels.indexOf('H1')).toBe(0);
    expect(levels.filter((tag) => tag === 'H1')).toHaveLength(1);
    expect(container.querySelector('main')).toBeNull();
    const eager = [...container.querySelectorAll('img')].filter((img) => img.getAttribute('loading') !== 'lazy');
    expect(eager).toHaveLength(1);
    expect(eager[0]?.getAttribute('sizes')).toBe('100vw');
  });

  it('has no axe violations', async () => {
    const { container } = render(<main>{await HomePage(props('tr'))}</main>);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('renders nothing for empty content', async () => {
    content.banner.mockResolvedValue(emptyBanner);
    content.boards.mockResolvedValue([]);
    content.products.mockResolvedValue([]);
    content.areas.mockResolvedValue([]);
    const { container } = await renderPage('tr');
    expect(container.querySelector('section, h1, h2, a')).toBeNull();
  });

  it('shows only the sections that have content', async () => {
    content.banner.mockResolvedValue(emptyBanner);
    content.boards.mockResolvedValue([]);
    content.products.mockResolvedValue(products);
    await renderPage('en');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Our Favorite Products',
      'Our Work Areas',
    ]);
    expect(screen.queryByRole('link', { name: /^Explore now/ })).toBeNull();
  });

  it('draws the banner without a photo when none is set', async () => {
    content.banner.mockResolvedValue({ ...banner, imageUrl: '' });
    const { container } = await renderPage('tr');
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(container.querySelector('section[aria-labelledby="home-title"] img')).toBeNull();
  });

  it.each([
    ['tr', 'Description TR'],
    ['en', 'Description EN'],
  ])('describes the page in %s from the saved metadata', async (locale, description) => {
    content.metadata.mockResolvedValue({
      title: pair('Title'),
      description: pair('Description'),
      updatedAt: new Date(),
    });
    const metadata = await generateMetadata(props(locale));
    expect(metadata.description).toBe(description);
  });

  it('omits the description when no metadata row or text exists', async () => {
    content.metadata.mockResolvedValue(null);
    await expect(generateMetadata(props('tr'))).resolves.not.toHaveProperty('description');
    content.metadata.mockResolvedValue({ title: none, description: none, updatedAt: new Date() });
    await expect(generateMetadata(props('en'))).resolves.not.toHaveProperty('description');
    await expect(generateMetadata(props('fr'))).resolves.toEqual({});
  });

  const ldBlocks = (container: HTMLElement) =>
    [...container.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
      JSON.parse(script.textContent ?? ''),
    );

  it.each([
    ['tr', 'https://example.test/tr'],
    ['en', 'https://example.test/en'],
  ])('describes the site and the organization as structured data in %s', async (locale, url) => {
    const { container } = await renderPage(locale);
    const [website, organization] = ldBlocks(container);
    expect(website).toMatchObject({ '@type': 'WebSite', url, name: `Brand ${locale.toUpperCase()}` });
    expect(organization).toMatchObject({
      '@type': 'Organization',
      sameAs: ['https://instagram.example/tanyeri'],
      contactPoint: { email: 'info@example.test' },
    });
    expect(organization).not.toHaveProperty('description');
  });

  it('repeats the demo notice in the organization data only in demo mode', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    const { container } = await renderPage('en');
    expect(ldBlocks(container)[1]).toMatchObject({ description: en.DemoBand.text });
  });

  it('shows the saved home title as it is, without the site template', async () => {
    content.metadata.mockResolvedValue({
      title: pair('Title'),
      description: pair('Description'),
      updatedAt: new Date(),
    });
    expect((await generateMetadata(props('en'))).title).toEqual({ absolute: 'Title EN' });
    content.metadata.mockResolvedValue(null);
    await expect(generateMetadata(props('en'))).resolves.not.toHaveProperty('title');
  });

  it('gives the home page the root address as x-default and its own canonical', async () => {
    const metadata = await generateMetadata(props('en'));
    expect(metadata.alternates).toEqual({
      canonical: '/en',
      languages: { tr: '/tr', en: '/en', 'x-default': '/' },
    });
  });

  it('answers an unknown language with not-found', async () => {
    await expect(HomePage(props('fr'))).rejects.toThrow();
  });
});
