import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PostCard } from '../../../../components/blog/post-card.tsx';
import { PostDate } from '../../../../components/blog/post-date.tsx';
import { Container } from '../../../../components/container.tsx';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { Pagination } from '../../../../components/pagination.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { getPathname } from '../../../../i18n/navigation.ts';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageSeo, type PageHref } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { listPublishedPosts } from '../../../../server/content/blog.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';

const PAGE_SIZE = 8;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// A value that is missing, repeated or not a positive whole number counts as absent.
function parsePage(value: string | undefined, pageCount: number): number {
  const page = value !== undefined && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
  return page <= pageCount ? page : 1;
}

// The page and its metadata read the same list, so it is loaded once per request.
const loadListing = cache(async (rawPage: string | undefined) => {
  const posts = await listPublishedPosts();
  const pageCount = Math.ceil(posts.length / PAGE_SIZE);
  return { posts, pageCount, current: parsePage(rawPage, pageCount) };
});

const listHref = (page: number): PageHref => (page > 1 ? { pathname: '/blog', query: { page } } : '/blog');

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/blog'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const query = await searchParams;
  const [header, t, page, listing] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getTranslations({ locale, namespace: 'Blog' }),
    getPageMetadata('blog'),
    loadListing(single(query.page)),
  ]);
  const metadata = toMetadata(page, locale, undefined, header('blog'));
  // A later page is its own address with its own title; it must not point its canonical at the first page.
  const paged = listing.current > 1;
  return {
    ...metadata,
    ...(paged ? { title: `${String(metadata.title)} - ${t('pageSuffix', { page: listing.current })}` } : {}),
    ...pageSeo(locale, listHref(listing.current)),
    // An empty list answers 200, so it is kept out of the index instead of looking like a soft 404.
    ...(listing.posts.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BlogPage({ params, searchParams }: PageProps<'/[locale]/blog'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const query = await searchParams;
  const [header, t, listing] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getTranslations({ locale, namespace: 'Blog' }),
    loadListing(single(query.page)),
  ]);
  const { posts, pageCount, current } = listing;
  const visible = posts.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pageItems = [
    ...(current > 1 ? [{ label: t('previous'), href: getPathname({ locale, href: listHref(current - 1) }) }] : []),
    ...Array.from({ length: pageCount }, (_, index) => ({
      label: String(index + 1),
      href: getPathname({ locale, href: listHref(index + 1) }),
      current: index + 1 === current,
    })),
    ...(current < pageCount ? [{ label: t('next'), href: getPathname({ locale, href: listHref(current + 1) }) }] : []),
  ];

  return (
    <>
      <JsonLd
        data={breadcrumbData(locale, [
          { name: header('home'), href: '/' },
          { name: header('blog'), href: '/blog' },
        ])}
      />
      <SectionTitle title={header('blog')} level={1} />
      <div className="pb-[clamp(2.5rem,6vw,4.5rem)]">
        <Container>
          {visible.length === 0 ? (
            <p className="text-center text-muted">{t('empty')}</p>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              {visible.map((post) => (
                <li key={post.id}>
                  <PostCard
                    title={post.title[locale]}
                    excerpt={post.excerpt[locale]}
                    imageUrl={post.imageUrl}
                    href={getPathname({ locale, href: { pathname: '/blog/[slug]', params: { slug: post.slug } } })}
                    date={
                      post.publishedAt ? (
                        <PostDate date={post.publishedAt} locale={locale} label={(date) => t('published', { date })} />
                      ) : null
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {pageCount > 1 ? (
            <div className="mt-8">
              <Pagination label={t('pages')} items={pageItems} />
            </div>
          ) : null}
        </Container>
      </div>
    </>
  );
}
