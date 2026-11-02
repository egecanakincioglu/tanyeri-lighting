import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../test/axe.ts';
import BlogPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({
  posts: [] as unknown[],
  metadata: null as null | { title: { tr: string; en: string }; description: { tr: string; en: string } },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../test/translations.ts')).getTranslations,
}));
vi.mock('../../../../server/content/blog.ts', () => ({ listPublishedPosts: async () => content.posts }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: async () => content.metadata }));

const props = (locale: string, query: Record<string, string | string[]> = {}) =>
  ({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query) }) as Parameters<typeof BlogPage>[0];

const makePost = (n: number) => ({
  id: `p${n}`,
  slug: `post-${n}`,
  imageUrl: '/demo/product-kare-sarkit.webp',
  imageAlt: { tr: 'Görsel', en: 'Picture' },
  title: { tr: `Yazı ${n}`, en: `Post ${n}` },
  description: { tr: 'Açıklama', en: 'Description' },
  excerpt: { tr: `Özet ${n}`, en: `Excerpt ${n}` },
  publishedAt: new Date(Date.UTC(2026, 0, n)),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('BlogPage', () => {
  beforeEach(() => {
    content.posts = [makePost(3), makePost(2), makePost(1)];
    content.metadata = {
      title: { tr: 'Kayıtlı', en: 'Saved title' },
      description: { tr: 'Açıklama', en: 'Saved description' },
    };
  });
  afterEach(cleanup);

  it('renders the one h1 and a card per article with its date, in the given order', async () => {
    render(await BlogPage(props('en')));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Blog');
    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent);
    expect(titles).toEqual(['Post 3', 'Post 2', 'Post 1']);
    const first = screen.getAllByRole('article')[0]!;
    expect(within(first).getByRole('link', { name: 'Post 3' }).getAttribute('href')).toBe('/en/blog/post-3');
    expect(within(first).getByText('Excerpt 3')).toBeTruthy();
    expect(within(first).getByText('Published on January 3, 2026')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();
  });

  it('loads the first picture at once and the rest lazily', async () => {
    const { container } = render(await BlogPage(props('en')));
    const pictures = [...container.querySelectorAll('img')];
    expect(pictures).toHaveLength(3);
    expect(pictures[0]!.getAttribute('loading')).toBe('eager');
    expect(pictures[0]!.getAttribute('fetchpriority')).toBe('high');
    expect(pictures.slice(1).map((picture) => picture.getAttribute('loading'))).toEqual(['lazy', 'lazy']);
  });

  it('is Turkish at the Turkish address', async () => {
    render(await BlogPage(props('tr')));
    expect(screen.getByRole('link', { name: 'Yazı 3' }).getAttribute('href')).toBe('/tr/blog/post-3');
    expect(screen.getByText('Yayın tarihi: 3 Ocak 2026')).toBeTruthy();
  });

  it('pages the list and gives a later page its own address and title', async () => {
    content.posts = Array.from({ length: 10 }, (_, index) => makePost(10 - index));
    render(await BlogPage(props('en', { page: '2' })));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(2);
    const pages = screen.getByRole('navigation', { name: 'Pages' });
    expect(within(pages).getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe('/en/blog');
    expect(within(pages).getByRole('link', { name: '2' }).getAttribute('aria-current')).toBe('page');
    expect(within(pages).getByRole('link', { name: '2' }).getAttribute('href')).toBe('/en/blog?page=2');
    const metadata = await generateMetadata(props('en', { page: '2' }));
    expect(metadata.title).toBe('Saved title - Page 2');
    expect(metadata.alternates?.canonical).toBe('/en/blog?page=2');
  });

  it('treats a page number that does not exist as the first page', async () => {
    render(await BlogPage(props('en', { page: '9' })));
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
    expect((await generateMetadata(props('en', { page: 'x' }))).alternates?.canonical).toBe('/en/blog');
  });

  it('says so and stays out of the index when there are no articles', async () => {
    content.posts = [];
    render(await BlogPage(props('en')));
    expect(screen.getByText('There are no articles yet.')).toBeTruthy();
    expect((await generateMetadata(props('en'))).robots).toEqual({ index: false, follow: true });
  });

  it('uses the saved page info for the title, description and alternates', async () => {
    const metadata = await generateMetadata(props('tr'));
    expect(metadata).toMatchObject({ title: 'Kayıtlı', description: 'Açıklama' });
    expect(metadata.alternates).toMatchObject({
      canonical: '/tr/blog',
      languages: { tr: '/tr/blog', en: '/en/blog', 'x-default': '/tr/blog' },
    });
    content.metadata = null;
    expect((await generateMetadata(props('en'))).title).toBe('Blog');
  });

  it('writes the breadcrumb data', async () => {
    const { container } = render(await BlogPage(props('en')));
    const data = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent);
    expect(data['@type']).toBe('BreadcrumbList');
    expect(data.itemListElement).toHaveLength(2);
  });

  it('answers an unknown language with not found and has no axe violations', async () => {
    await expect(BlogPage(props('xx'))).rejects.toThrow('not found');
    expect(await generateMetadata(props('xx'))).toEqual({});
    const { container } = render(await BlogPage(props('en')));
    expect(await axeViolations(container)).toEqual([]);
  });
});
