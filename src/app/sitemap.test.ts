import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_KEYS } from '../server/content/schemas.ts';
import sitemap from './sitemap.ts';

const content = vi.hoisted(() => ({
  metadata: vi.fn(),
  legal: vi.fn(),
  products: vi.fn(),
  categories: vi.fn(),
  posts: vi.fn(),
  dates: vi.fn(),
}));

vi.mock('../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));
vi.mock('../server/content/legal-pages.ts', () => ({ getLegalPage: content.legal }));
vi.mock('../server/content/blog.ts', () => ({ listPostChanges: content.posts }));
vi.mock('../server/content/products.ts', () => ({ listProductChanges: content.products }));
vi.mock('../server/content/content-dates.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/content/content-dates.ts')>()),
  listContentDates: content.dates,
}));
vi.mock('../server/content/categories.ts', () => ({ listCategoryChanges: content.categories }));
// connection() only works inside a request.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

const metaDate = new Date('2026-03-01T10:00:00Z');
const legalDate = new Date('2026-04-01T10:00:00Z');
const productDate = new Date('2026-05-01T10:00:00Z');
const postDate = new Date('2026-06-01T10:00:00Z');
const categoryDate = new Date('2026-05-02T10:00:00Z');

describe('sitemap', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
    content.metadata.mockResolvedValue(null);
    content.legal.mockResolvedValue({ updatedAt: legalDate });
    content.products.mockResolvedValue([{ slug: 'spot-12w', updatedAt: productDate }]);
    content.posts.mockResolvedValue([{ slug: 'linear-lighting', updatedAt: postDate }]);
    content.categories.mockResolvedValue([{ key: 'ray-spot', updatedAt: categoryDate }]);
    content.dates.mockResolvedValue({});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    content.metadata.mockReset();
    content.legal.mockReset();
    content.products.mockReset();
    content.posts.mockReset();
    content.categories.mockReset();
    content.dates.mockReset();
  });

  it('lists every public page, category view and product in both languages with absolute addresses', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toHaveLength((PAGE_KEYS.length + 3) * 2);
    expect(urls).toContain('https://example.test/tr/urunler?category=ray-spot');
    expect(urls).toContain('https://example.test/en/products?category=ray-spot');
    expect(urls).toContain('https://example.test/tr');
    expect(urls).toContain('https://example.test/en');
    expect(urls).toContain('https://example.test/tr/hakkimizda');
    expect(urls).toContain('https://example.test/en/about');
    expect(urls).toContain('https://example.test/tr/urunler/spot-12w');
    expect(urls).toContain('https://example.test/en/products/spot-12w');
    expect(urls).toContain('https://example.test/tr/blog/linear-lighting');
    expect(urls).toContain('https://example.test/en/blog/linear-lighting');
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('never lists the admin area', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.filter((url) => /yonetim|admin/.test(url))).toEqual([]);
  });

  it('takes lastModified from the record, and leaves it out when there is none', async () => {
    content.metadata.mockImplementation((key: string) =>
      Promise.resolve(key === 'about' ? { updatedAt: metaDate } : null),
    );
    const entries = await sitemap();
    const byUrl = (url: string) => entries.find((entry) => entry.url === url);
    expect(byUrl('https://example.test/en/about')?.lastModified).toEqual(metaDate);
    expect(byUrl('https://example.test/tr/urunler/spot-12w')?.lastModified).toEqual(productDate);
    expect(byUrl('https://example.test/en/products?category=ray-spot')?.lastModified).toEqual(categoryDate);
    expect(byUrl('https://example.test/tr/gizlilik')?.lastModified).toEqual(legalDate);
    expect(byUrl('https://example.test/en/services')).not.toHaveProperty('lastModified');
  });

  it('dates an article by its record and the blog list by the newest article', async () => {
    const entries = await sitemap();
    const byUrl = (url: string) => entries.find((entry) => entry.url === url);
    expect(byUrl('https://example.test/en/blog/linear-lighting')?.lastModified).toEqual(postDate);
    expect(byUrl('https://example.test/tr/blog')?.lastModified).toEqual(postDate);
    content.posts.mockResolvedValue([]);
    expect(byUrl('https://example.test/en/blog')).toBeTruthy();
    expect((await sitemap()).find((entry) => entry.url === 'https://example.test/en/blog')).not.toHaveProperty(
      'lastModified',
    );
  });

  it('dates a page by the content it shows, and by its page info when that is newer', async () => {
    const homeDate = new Date('2026-07-01T10:00:00Z');
    const servicesDate = new Date('2026-02-01T10:00:00Z');
    content.dates.mockResolvedValue({ home: homeDate, services: servicesDate, catalogs: servicesDate });
    content.metadata.mockImplementation((key: string) =>
      Promise.resolve(
        key === 'services'
          ? { updatedAt: metaDate }
          : key === 'catalogs'
            ? { updatedAt: new Date('2026-01-01') }
            : null,
      ),
    );
    const entries = await sitemap();
    const byUrl = (url: string) => entries.find((entry) => entry.url === url);
    expect(byUrl('https://example.test/tr')?.lastModified).toEqual(homeDate);
    expect(byUrl('https://example.test/en/services')?.lastModified).toEqual(metaDate);
    expect(byUrl('https://example.test/en/catalogs')?.lastModified).toEqual(servicesDate);
    expect(byUrl('https://example.test/en/projects')).not.toHaveProperty('lastModified');
  });

  it('dates the product list by the newest product or category', async () => {
    const entries = await sitemap();
    const list = (url: string) => entries.find((entry) => entry.url === url)?.lastModified;
    expect(list('https://example.test/en/products')).toEqual(categoryDate);
    content.categories.mockResolvedValue([]);
    content.products.mockResolvedValue([]);
    expect((await sitemap()).find((entry) => entry.url === 'https://example.test/en/products')).not.toHaveProperty(
      'lastModified',
    );
  });

  it('uses the later of a legal page and its page info', async () => {
    content.metadata.mockImplementation((key: string) =>
      Promise.resolve(key === 'terms' ? { updatedAt: new Date('2027-01-01T00:00:00Z') } : null),
    );
    const entries = await sitemap();
    expect(entries.find((entry) => entry.url === 'https://example.test/en/terms')?.lastModified).toEqual(
      new Date('2027-01-01T00:00:00Z'),
    );
  });

  it('leaves out a legal page that was never saved, since it answers 404', async () => {
    content.legal.mockResolvedValue(null);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((url) => /gizlilik|privacy|kullanim-kosullari|terms/.test(url))).toBe(false);
    expect(urls).toContain('https://example.test/tr/iletisim');
  });

  it('lists no category view when no category has products', async () => {
    content.categories.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((url) => url.includes('category='))).toBe(false);
    expect(urls).toHaveLength((PAGE_KEYS.length + 2) * 2);
  });

  it('fails as a whole when the database fails, never a partial list', async () => {
    content.products.mockRejectedValue(new Error('connection refused'));
    await expect(sitemap()).rejects.toThrow('connection refused');
    content.products.mockResolvedValue([]);
    content.categories.mockRejectedValue(new Error('category read failed'));
    await expect(sitemap()).rejects.toThrow('category read failed');
    content.categories.mockResolvedValue([]);
    content.dates.mockRejectedValue(new Error('dates failed'));
    await expect(sitemap()).rejects.toThrow('dates failed');
    content.dates.mockResolvedValue({});
    content.metadata.mockRejectedValue(new Error('timeout'));
    await expect(sitemap()).rejects.toThrow('timeout');
  });
});
