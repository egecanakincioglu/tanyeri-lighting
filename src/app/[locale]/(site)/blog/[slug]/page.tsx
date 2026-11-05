import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { PostDate } from '../../../../../components/blog/post-date.tsx';
import { Container } from '../../../../../components/container.tsx';
import { JsonLd } from '../../../../../components/json-ld.tsx';
import { MarkdownContent } from '../../../../../components/markdown-content.tsx';
import { SiteImage, eagerWhen } from '../../../../../components/site-image.tsx';
import { PROSE } from '../../../../../components/site/prose.ts';
import { getPathname } from '../../../../../i18n/navigation.ts';
import { routing } from '../../../../../i18n/routing.ts';
import { pageSeo } from '../../../../../lib/seo.ts';
import { articleData, breadcrumbData } from '../../../../../lib/structured-data.ts';
import {
  getPublishedPostBySlug,
  getPublishedPostRedirect,
  listOtherPosts,
} from '../../../../../server/content/blog.ts';

const postHref = (slug: string) => ({ pathname: '/blog/[slug]' as const, params: { slug } });

// Demo photos are 480 px wide; cap the image at 240 px: sharp on 2x screens.
const IMAGE_SIZES = '240px';

const linkClass = 'underline-offset-4 hover:text-accent-text hover:underline';

export async function generateMetadata({ params }: PageProps<'/[locale]/blog/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const post = await getPublishedPostBySlug(slug);
  if (!post?.publishedAt) return {};
  const seo = pageSeo(locale, postHref(post.slug));
  return {
    title: post.title[locale],
    description: post.description[locale],
    ...seo,
    openGraph: {
      ...seo.openGraph,
      type: 'article',
      title: post.title[locale],
      description: post.description[locale],
      publishedTime: post.publishedAt.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps<'/[locale]/blog/[slug]'>) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, header, post] = await Promise.all([
    getTranslations({ locale, namespace: 'Blog' }),
    getTranslations({ locale, namespace: 'Header' }),
    getPublishedPostBySlug(slug),
  ]);
  if (!post?.publishedAt) {
    const current = await getPublishedPostRedirect(slug);
    if (current) permanentRedirect(getPathname({ locale, href: postHref(current) }));
    notFound();
  }
  const published = post.publishedAt;
  const others = await listOtherPosts(post.slug, 2);
  const title = post.title[locale];
  const label = (date: string) => t('published', { date });

  return (
    <div className="py-[clamp(1.5rem,4vw,3rem)]">
      <JsonLd
        data={articleData(
          {
            headline: title,
            description: post.description[locale],
            image: post.imageUrl,
            published,
            modified: post.updatedAt,
            href: postHref(post.slug),
          },
          locale,
        )}
      />
      <JsonLd
        data={breadcrumbData(locale, [
          { name: header('home'), href: '/' },
          { name: header('blog'), href: '/blog' },
          { name: title, href: postHref(post.slug) },
        ])}
      />
      <Container>
        <div className="mx-auto max-w-3xl">
          <nav aria-label={t('breadcrumb')} className="mb-6 text-sm text-muted">
            <ol className="flex flex-wrap items-center gap-x-2">
              <li>
                <Link href={getPathname({ locale, href: '/' })} prefetch={false} className={linkClass}>
                  {header('home')}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={getPathname({ locale, href: '/blog' })} prefetch={false} className={linkClass}>
                  {header('blog')}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="wrap-break-word">
                {title}
              </li>
            </ol>
          </nav>

          <article>
            <header className="grid gap-x-8 gap-y-5 md:grid-cols-[15rem_1fr] md:items-start">
              <div className="md:col-start-2 md:row-start-1">
                <h1 className="text-[length:clamp(1.5rem,2.2vw,2rem)] leading-[1.2] font-bold tracking-tight wrap-break-word text-ink">
                  {title}
                </h1>
                <p className="mt-2 text-muted">
                  <PostDate date={published} locale={locale} label={label} />
                </p>
                <p className="mt-4 text-lg leading-relaxed text-ink">{post.description[locale]}</p>
              </div>
              <span className="relative block aspect-4/3 w-60 max-w-full overflow-hidden rounded-md bg-page md:col-start-1 md:row-start-1">
                <SiteImage
                  src={post.imageUrl}
                  alt={post.imageAlt[locale]}
                  fill
                  sizes={IMAGE_SIZES}
                  {...eagerWhen(true)}
                />
              </span>
            </header>
            <div className={`mt-8 break-words ${PROSE}`}>
              <MarkdownContent>{post.body[locale]}</MarkdownContent>
            </div>
          </article>

          {others.length > 0 ? (
            <section aria-labelledby="more-posts" className="mt-12 border-t border-hairline pt-8">
              <h2 id="more-posts" className="mb-3 text-xl font-bold text-ink">
                {t('more')}
              </h2>
              <ul>
                {others.map((other) => (
                  <li key={other.id} className="border-b border-hairline last:border-b-0">
                    <Link
                      href={getPathname({ locale, href: postHref(other.slug) })}
                      prefetch={false}
                      className="flex min-h-touch flex-col justify-center py-3 hover:text-accent-text"
                    >
                      <span className="font-semibold wrap-break-word">{other.title[locale]}</span>
                      {other.publishedAt ? (
                        <span className="text-sm text-muted">
                          <PostDate date={other.publishedAt} locale={locale} label={label} />
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="mt-10">
            <Link
              href={getPathname({ locale, href: '/blog' })}
              prefetch={false}
              className="group/back inline-flex min-h-touch items-center gap-1.5 font-semibold text-accent-text hover:underline hover:underline-offset-4"
            >
              <span aria-hidden="true" className="transition-transform duration-200 group-hover/back:-translate-x-0.75">
                ←
              </span>
              {t('back')}
            </Link>
          </p>
        </div>
      </Container>
    </div>
  );
}
