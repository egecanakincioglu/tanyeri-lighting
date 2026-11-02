import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Breadcrumb } from '../../../../../components/breadcrumb.tsx';
import { Card } from '../../../../../components/card.tsx';
import { Container } from '../../../../../components/container.tsx';
import { JsonLd } from '../../../../../components/json-ld.tsx';
import { SiteImage } from '../../../../../components/site-image.tsx';
import { getPathname } from '../../../../../i18n/navigation.ts';
import { routing } from '../../../../../i18n/routing.ts';
import type { Product } from '../../../../../server/content/schemas.ts';
import { pageSeo } from '../../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../../lib/structured-data.ts';
import { listCategories } from '../../../../../server/content/categories.ts';
import { getProductBySlug } from '../../../../../server/content/products.ts';

type Locale = (typeof routing.locales)[number];

const categoryHref = (key: string) => ({ pathname: '/products' as const, query: { category: key } });

// Power, size, colour and material in one line; a detail that is not filled in is left out.
const specsOf = (product: Product, locale: Locale) =>
  [product.power, product.dimensions, product.color[locale], product.material[locale]]
    .filter((value) => value !== '')
    .join(', ');

// The demo photos are 480 px wide, so the image is shown at most 240 px wide: sharp on 2x screens and not blown up.
const IMAGE_SIZES = '240px';

async function categoryName(key: string, locale: Locale): Promise<string> {
  const categories = await listCategories();
  return categories.find((entry) => entry.key === key)?.name[locale] ?? '';
}

async function loadProduct(slug: string, locale: Locale) {
  const found = await getProductBySlug(slug);
  if (!found) return null;
  if ('redirectTo' in found) {
    permanentRedirect(
      getPathname({ locale, href: { pathname: '/products/[slug]', params: { slug: found.redirectTo } } }),
    );
  }
  const category = await categoryName(found.product.categoryKey, locale);
  return { product: found.product, category };
}

export async function generateMetadata({ params }: PageProps<'/[locale]/products/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const [t, found] = await Promise.all([getTranslations({ locale, namespace: 'Product' }), getProductBySlug(slug)]);
  if (!found || 'redirectTo' in found) return {};
  const category = await categoryName(found.product.categoryKey, locale);
  const name = found.product.name[locale];
  const specs = specsOf(found.product, locale);
  return {
    title: category ? `${name} | ${category}` : name,
    description: t(specs ? 'description' : 'descriptionPlain', { name, specs, code: found.product.code }),
    ...pageSeo(locale, { pathname: '/products/[slug]', params: { slug: found.product.slug } }),
  };
}

export default async function ProductPage({ params }: PageProps<'/[locale]/products/[slug]'>) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  const [t, header, loaded] = await Promise.all([
    getTranslations({ locale, namespace: 'Product' }),
    getTranslations({ locale, namespace: 'Header' }),
    loadProduct(slug, locale),
  ]);
  if (!loaded) notFound();
  const { product, category } = loaded;
  const name = product.name[locale];

  const categoryLink = (
    <Link
      href={getPathname({ locale, href: categoryHref(product.categoryKey) })}
      prefetch={false}
      className="underline underline-offset-4 hover:text-accent-text"
    >
      {category}
    </Link>
  );
  const rows = [
    [t('code'), product.code],
    [t('category'), category],
    [t('color'), product.color[locale]],
    [t('material'), product.material[locale]],
    [t('power'), product.power],
    [t('dimensions'), product.dimensions],
  ].filter(([, value]) => value !== '');

  return (
    <div className="py-[clamp(1.5rem,4vw,3rem)]">
      <JsonLd
        data={breadcrumbData(locale, [
          { name: header('products'), href: '/products' },
          ...(category ? [{ name: category, href: categoryHref(product.categoryKey) }] : []),
          { name, href: { pathname: '/products/[slug]', params: { slug: product.slug } } },
        ])}
      />
      <Container>
        <div className="mb-2">
          <Breadcrumb
            label={t('breadcrumb')}
            items={[
              { name: header('products'), href: getPathname({ locale, href: '/products' }) },
              ...(category
                ? [{ name: category, href: getPathname({ locale, href: categoryHref(product.categoryKey) }) }]
                : []),
              { name },
            ]}
          />
        </div>

        <Card>
          <div className="grid gap-x-8 gap-y-5 p-5 md:grid-cols-[15rem_1fr] md:p-8">
            <div className="md:col-start-2">
              <h1 className="text-[length:clamp(1.5rem,2.2vw,2rem)] leading-[1.2] font-bold tracking-tight text-ink">
                {name}
              </h1>
              <p className="mt-1 text-muted">
                {category ? (
                  <>
                    {categoryLink} · {product.code}
                  </>
                ) : (
                  product.code
                )}
              </p>
            </div>
            <div className="md:col-start-1 md:row-span-3 md:row-start-1">
              <span className="relative mx-auto block aspect-square w-60 max-w-full overflow-hidden rounded-md">
                <SiteImage
                  src={product.imageUrl}
                  alt={name}
                  fill
                  sizes={IMAGE_SIZES}
                  loading="eager"
                  fetchPriority="high"
                />
              </span>
            </div>
            <div className="md:col-start-2">
              <h2 className="sr-only">{t('details')}</h2>
              <dl>
                {rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="grid grid-cols-[minmax(6rem,2fr)_3fr] gap-x-4 border-t border-hairline py-2.5 last:border-b"
                  >
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="md:col-start-2">
              <Link
                href={getPathname({ locale, href: { pathname: '/contact', query: { product: product.slug } } })}
                prefetch={false}
                rel="nofollow"
                className="inline-flex min-h-touch items-center justify-center rounded-md bg-accent px-6 font-semibold text-on-accent transition-colors duration-300 hover:bg-accent-hover"
              >
                {t('request')}
              </Link>
            </div>
          </div>
        </Card>
      </Container>
    </div>
  );
}
