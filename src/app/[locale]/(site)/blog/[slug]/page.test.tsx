import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../test/axe.ts';
import BlogPostPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ post: vi.fn(), others: vi.fn() }));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../test/translations.ts')).getTranslations,
}));
vi.mock('../../../../../server/content/blog.ts', () => ({
  getPublishedPostBySlug: content.post,
  listOtherPosts: content.others,
}));

const props = (locale: string, slug = 'linear-lighting') =>
  ({ params: Promise.resolve({ locale, slug }) }) as Parameters<typeof BlogPostPage>[0];

const pair = (tr: string, en: string) => ({ tr, en });
const post = {
  id: 'p1',
  slug: 'linear-lighting',
  imageUrl: '/demo/product-kare-sarkit.webp',
  imageAlt: pair('Askılı lineer armatür', 'A linear pendant luminaire'),
  title: pair('Lineer aydınlatma nedir?', 'What is linear lighting?'),
  description: pair('Kısa açıklama', 'A short lead'),
  excerpt: pair('Özet', 'Excerpt'),
  body: pair('Metin\n\n## Bölüm', 'Body text with [a link](/en/contact)\n\n## Section\n\n### Detail'),
  publishedAt: new Date('2026-03-01T00:00:00.000Z'),
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  updatedAt: new Date('2026-04-02T00:00:00.000Z'),
};
const other = (n: number) => ({
  ...post,
  id: `o${n}`,
  slug: `other-${n}`,
  title: pair(`Diğer ${n}`, `Other ${n}`),
  publishedAt: new Date(Date.UTC(2026, 0, n)),
});

function jsonLd(container: HTMLElement) {
  return [...container.querySelectorAll('script[type="application/ld+json"]')].map((node) =>
    JSON.parse(node.textContent ?? ''),
  );
}

describe('BlogPostPage', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
    content.post.mockReset();
    content.post.mockResolvedValue(post);
    content.others.mockReset();
    content.others.mockResolvedValue([other(1), other(2)]);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it('shows the breadcrumb, the h1, the date, the picture, the lead and the body', async () => {
    render(await BlogPostPage(props('en')));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('What is linear lighting?');
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/en');
    expect(within(crumbs).getByRole('link', { name: 'Blog' }).getAttribute('href')).toBe('/en/blog');
    expect(screen.getByText('Published on March 1, 2026').getAttribute('datetime')).toBe('2026-03-01');
    expect(screen.getByText('A short lead')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'A linear pendant luminaire' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'a link' }).getAttribute('href')).toBe('/en/contact');
    expect(screen.getByRole('heading', { level: 2, name: 'Section' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /All articles/ }).getAttribute('href')).toBe('/en/blog');
  });

  it('loads the article picture at once, as a plain image', async () => {
    render(await BlogPostPage(props('en')));
    const picture = screen.getByRole('img', { name: 'A linear pendant luminaire' });
    expect(picture.getAttribute('loading')).toBe('eager');
    expect(picture.getAttribute('fetchpriority')).toBe('high');
  });

  it('links to two other articles', async () => {
    render(await BlogPostPage(props('en')));
    expect(content.others).toHaveBeenCalledWith('linear-lighting', 2);
    const section = screen.getByRole('region', { name: 'More articles' });
    expect(
      within(section)
        .getByRole('link', { name: /Other 1/ })
        .getAttribute('href'),
    ).toBe('/en/blog/other-1');
    expect(
      within(section)
        .getByRole('link', { name: /Other 2/ })
        .getAttribute('href'),
    ).toBe('/en/blog/other-2');
  });

  it('leaves out the section when there is no other article', async () => {
    content.others.mockResolvedValue([]);
    render(await BlogPostPage(props('en')));
    expect(screen.queryByRole('region', { name: 'More articles' })).toBeNull();
  });

  it('is Turkish at the Turkish address', async () => {
    render(await BlogPostPage(props('tr')));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Lineer aydınlatma nedir?');
    expect(screen.getByText('Yayın tarihi: 1 Mart 2026')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Askılı lineer armatür' })).toBeTruthy();
  });

  it('answers a slug that does not exist, a draft and an unknown language with not found', async () => {
    content.post.mockResolvedValue(null);
    await expect(BlogPostPage(props('en', 'nope'))).rejects.toThrow('not found');
    expect(await generateMetadata(props('en', 'nope'))).toEqual({});
    content.post.mockResolvedValue({ ...post, publishedAt: null });
    await expect(BlogPostPage(props('en'))).rejects.toThrow('not found');
    expect(await generateMetadata(props('en'))).toEqual({});
    await expect(BlogPostPage(props('xx'))).rejects.toThrow('not found');
    expect(await generateMetadata(props('xx'))).toEqual({});
  });

  it('writes the saved fields into the metadata, with canonical and both languages', async () => {
    const metadata = await generateMetadata(props('tr'));
    expect(metadata).toMatchObject({
      title: 'Lineer aydınlatma nedir?',
      description: 'Kısa açıklama',
      alternates: {
        canonical: '/tr/blog/linear-lighting',
        languages: { tr: '/tr/blog/linear-lighting', en: '/en/blog/linear-lighting' },
      },
      openGraph: {
        type: 'article',
        url: '/tr/blog/linear-lighting',
        locale: 'tr_TR',
        publishedTime: '2026-03-01T00:00:00.000Z',
        modifiedTime: '2026-04-02T00:00:00.000Z',
      },
    });
  });

  it('writes Article and BreadcrumbList data from what the page shows', async () => {
    const { container } = render(await BlogPostPage(props('en')));
    const [article, breadcrumb] = jsonLd(container);
    expect(article).toMatchObject({
      '@type': 'Article',
      headline: 'What is linear lighting?',
      description: 'A short lead',
      image: 'https://example.test/demo/product-kare-sarkit.webp',
      datePublished: '2026-03-01T00:00:00.000Z',
      dateModified: '2026-04-02T00:00:00.000Z',
      author: { '@id': 'https://example.test/#organization' },
      publisher: { '@id': 'https://example.test/#organization' },
    });
    expect(breadcrumb.itemListElement.map((item: { name: string }) => item.name)).toEqual([
      'Home',
      'Blog',
      'What is linear lighting?',
    ]);
  });

  it('escapes a closing script tag in a saved title so it can not leave the data block', async () => {
    content.post.mockResolvedValue({ ...post, title: pair('x', '</script><script>alert(1)</script>') });
    const { container } = render(await BlogPostPage(props('en')));
    const scripts = container.querySelectorAll('script');
    expect(scripts).toHaveLength(2);
    for (const script of scripts) expect(script.textContent).not.toContain('<');
    expect(jsonLd(container)[0].headline).toBe('</script><script>alert(1)</script>');
  });

  it('has no axe violations', async () => {
    const { container } = render(await BlogPostPage(props('en')));
    expect(await axeViolations(container)).toEqual([]);
  });
});
