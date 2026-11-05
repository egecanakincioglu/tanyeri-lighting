import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { Breadcrumb } from '../../../../components/breadcrumb.tsx';
import { Container } from '../../../../components/container.tsx';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { Pagination } from '../../../../components/pagination.tsx';
import { ProductCard } from '../../../../components/product-card.tsx';
import { ScrollToCurrent } from '../../../../components/scroll-to-current.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { getPathname } from '../../../../i18n/navigation.ts';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageSeo, type PageHref } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { listCategories } from '../../../../server/content/categories.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';
import { listProducts } from '../../../../server/content/products.ts';

const PAGE_SIZE = 24;

// Image widths follow the grid: 2 columns under 540 px, 3 from 540, 4 from 900, 6 from 1280; fixed width from 1440.
const cardSizes =
  '(min-width: 150rem) 224px, (min-width: 120rem) 197px, (min-width: 90rem) 176px, (min-width: 80rem) calc(15.3vw - 2.7rem), (min-width: 56.25rem) calc(23vw - 2.4rem), (min-width: 33.75rem) calc(30.7vw - 2.3rem), calc(46vw - 2rem)';

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function parsePage(value: string | undefined, pageCount: number): number {
  const page = value !== undefined && /^[1-9]\d{0,5}$/.test(value) ? Number(value) : 1;
  return page <= pageCount ? page : 1;
}

// The page and its metadata share one load per request.
const loadListing = cache(async (requested: string | undefined, rawPage: string | undefined) => {
  const categories = await listCategories();
  const selected = categories.find((entry) => entry.key === requested);
  const category = selected?.key;
  const products = await listProducts(category);
  const pageCount = Math.ceil(products.length / PAGE_SIZE);
  return { categories, selected, category, products, pageCount, current: parsePage(rawPage, pageCount) };
});

export async function generateMetadata({ params, searchParams }: PageProps<'/[locale]/products'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const query = await searchParams;
  const [t, products, page, listing] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getTranslations({ locale, namespace: 'Products' }),
    getPageMetadata('products'),
    loadListing(single(query.category), single(query.page)),
  ]);
  const { selected } = listing;
  // A category view has its own title and description; empty ones fall back to the category name.
  const metadata = toMetadata(
    page,
    locale,
    selected ? selected.seoTitle[locale] || selected.name[locale] : undefined,
    t('products'),
  );
  const description = selected?.seoDescription[locale];
  // A later page or category view is its own canonical.
  const paged = listing.current > 1;
  const target = {
    ...(listing.category ? { category: listing.category } : {}),
    ...(paged ? { page: listing.current } : {}),
  };
  const href: PageHref = Object.keys(target).length === 0 ? '/products' : { pathname: '/products', query: target };
  return {
    ...metadata,
    ...(description ? { description } : {}),
    ...(paged ? { title: `${String(metadata.title)} - ${products('pageSuffix', { page: listing.current })}` } : {}),
    ...pageSeo(locale, href),
    // An empty list returns 200, so keep it out of the index to avoid a soft 404.
    ...(listing.products.length === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ProductsPage({ params, searchParams }: PageProps<'/[locale]/products'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const query = await searchParams;

  const [t, header] = await Promise.all([
    getTranslations({ locale, namespace: 'Products' }),
    getTranslations({ locale, namespace: 'Header' }),
  ]);
  const { categories, selected, category, products, pageCount, current } = await loadListing(
    single(query.category),
    single(query.page),
  );

  // The first page and the all-products list use the plain address.
  const listHref = (categoryKey: string | undefined, page = 1) => {
    const query = { ...(categoryKey ? { category: categoryKey } : {}), ...(page > 1 ? { page } : {}) };
    return getPathname({
      locale,
      href: Object.keys(query).length === 0 ? '/products' : { pathname: '/products', query },
    });
  };

  const tabs = [
    { key: undefined, label: t('all') },
    ...categories.map((entry) => ({ key: entry.key, label: entry.name[locale] })),
  ];
  const pageItems = [
    ...(current > 1 ? [{ label: t('previous'), href: listHref(category, current - 1) }] : []),
    ...Array.from({ length: pageCount }, (_, index) => ({
      label: String(index + 1),
      href: listHref(category, index + 1),
      current: index + 1 === current,
    })),
    ...(current < pageCount ? [{ label: t('next'), href: listHref(category, current + 1) }] : []),
  ];
  const visible = products.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const intro = current === 1 ? selected?.intro[locale] : '';

  return (
    <>
      {selected ? (
        <>
          <JsonLd
            data={breadcrumbData(locale, [
              { name: header('products'), href: '/products' },
              { name: selected.name[locale], href: { pathname: '/products', query: { category: selected.key } } },
            ])}
          />
          <div className="pt-3">
            <Container>
              <Breadcrumb
                label={t('breadcrumb')}
                items={[{ name: header('products'), href: listHref(undefined) }, { name: selected.name[locale] }]}
              />
            </Container>
          </div>
        </>
      ) : (
        <JsonLd
          data={breadcrumbData(locale, [
            { name: header('home'), href: '/' },
            { name: header('products'), href: '/products' },
          ])}
        />
      )}
      <SectionTitle title={selected ? selected.h1[locale] || selected.name[locale] : t('title')} level={1} />
      <div className="pb-[clamp(2.5rem,6vw,4.5rem)]">
        <Container>
          {intro ? <p className="mx-auto mb-8 max-w-2xl text-center text-muted">{intro}</p> : null}
          <p className="py-2 text-center text-xs text-muted min-[1025px]:hidden motion-safe:animate-hint">
            {t('swipeHint')}
          </p>
          <nav aria-label={t('categories')}>
            <ScrollToCurrent className="mb-2.5 flex border-b-2 border-hairline max-[1024px]:snap-x max-[1024px]:snap-mandatory max-[1024px]:overflow-x-auto min-[1025px]:justify-center [scrollbar-color:var(--color-accent)_var(--color-page)] [scrollbar-width:thin]">
              {tabs.map((tab) => {
                const active = tab.key === category;
                return (
                  <li
                    key={tab.key ?? 'all'}
                    className="snap-start min-[1025px]:flex-1 max-[1024px]:flex-[0_0_50%] max-[1024px]:mid:flex-[0_0_33.333%]"
                  >
                    <Link
                      href={listHref(tab.key)}
                      prefetch={false}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex min-h-touch items-center justify-center px-4 py-2.5 text-[0.9375rem] whitespace-nowrap transition-colors duration-300 hover:text-accent-text min-[1025px]:px-2.5 min-[1025px]:text-base ${
                        active
                          ? 'font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-[5px] after:rounded-[3px] after:bg-accent after:content-[""]'
                          : 'font-medium'
                      }`}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ScrollToCurrent>
          </nav>

          {visible.length === 0 ? (
            <p className="mt-8 text-center text-muted">{t('empty')}</p>
          ) : (
            <ul className="mt-8 grid grid-cols-2 gap-3 xs:grid-cols-3 xs:gap-4 wide:grid-cols-4 xl:grid-cols-6 xl:gap-5">
              {visible.map((product, index) => (
                <li key={product.id}>
                  <ProductCard
                    imageUrl={product.imageUrl}
                    name={product.name[locale]}
                    href={getPathname({
                      locale,
                      href: { pathname: '/products/[slug]', params: { slug: product.slug } },
                    })}
                    sizes={cardSizes}
                    eager={index === 0}
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
