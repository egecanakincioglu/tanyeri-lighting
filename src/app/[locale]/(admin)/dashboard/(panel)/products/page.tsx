import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ProductFilters, ProductPager } from '../../../../../../components/admin/products/list-controls.tsx';
import { buildFormTexts } from '../../../../../../components/admin/texts.ts';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { ResourceList } from '../../../../../../components/admin/resource-list.tsx';
import { ButtonLink } from '../../../../../../components/button.tsx';
import { getPathname } from '../../../../../../i18n/navigation.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import { paginate, parseProductQuery, searchProducts } from '../../../../../../server/admin/product-list.ts';
import { deleteProductAction, reorderProductsAction } from '../../../../../../server/admin/products-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listCategories } from '../../../../../../server/content/categories.ts';
import { listFeaturedProducts } from '../../../../../../server/content/featured-products.ts';
import { listProducts } from '../../../../../../server/content/products.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/products'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProducts' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ProductsAdminPage({ params, searchParams }: PageProps<'/[locale]/dashboard/products'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, categories, products, featured, raw] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProducts' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listCategories(),
    listProducts(),
    listFeaturedProducts(),
    searchParams,
  ]);
  const formTexts = buildFormTexts(form);
  const query = parseProductQuery(
    raw,
    categories.map((category) => category.key),
  );
  const selected = categories.find((category) => category.key === query.category);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name[locale]]));
  const featuredIds = new Set(featured.map((product) => product.id));

  const matches = searchProducts(
    selected ? products.filter((product) => product.categoryId === selected.id) : products,
    query.q,
  );
  // The order of a category is saved as a whole, so the arrows need all of its products on one screen.
  const reorderable = selected !== undefined && query.q === '';
  const shown = reorderable ? { items: matches, page: 1, pages: 1 } : paginate(matches, query.page);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          categories.length === 0 ? undefined : (
            <ButtonLink href={getPathname({ locale, href: '/dashboard/products/new' })} prefetch={false}>
              {t('create')}
            </ButtonLink>
          )
        }
      />
      {categories.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-surface px-5 py-10 text-center text-muted">
          {t('noCategories')}
        </p>
      ) : (
        <>
          <ProductFilters
            action={getPathname({ locale, href: '/dashboard/products' })}
            q={query.q}
            category={selected?.key ?? ''}
            categories={categories.map((category) => ({ value: category.key, label: category.name[locale] }))}
            texts={{
              searchLabel: t('searchLabel'),
              categoryLabel: t('categoryLabel'),
              allCategories: t('allCategories'),
              search: t('search'),
              clear: t('clear'),
            }}
          />
          {!reorderable && products.length > 1 && <p className="mb-4 text-sm text-muted">{t('reorderHint')}</p>}
          <ResourceList
            locale={locale}
            rows={shown.items.map((product) => ({
              id: product.id,
              title: product.name[locale],
              subtitle: `${product.code} · ${categoryNames.get(product.categoryId) ?? ''}`,
              imageUrl: product.imageUrl,
              ...(featuredIds.has(product.id) ? { deleteBody: t('deleteBodyFeatured', { name: '{name}' }) } : {}),
              edit: { pathname: '/dashboard/products/[id]', params: { id: product.id } },
            }))}
            reorder={reorderable ? reorderProductsAction.bind(null, selected.id) : undefined}
            deleteAction={deleteProductAction}
            formTexts={formTexts}
            disabledReason={isDemoMode() ? formTexts.demoNote : undefined}
            texts={{
              edit: t('edit'),
              moveUp: t('moveUp'),
              moveDown: t('moveDown'),
              empty: products.length === 0 ? t('empty') : t('noMatch'),
              reordered: t('reordered'),
              delete: {
                trigger: t('delete'),
                title: t('deleteTitle'),
                body: t('deleteBody'),
                confirm: t('deleteConfirm'),
                working: t('deleting'),
                cancel: form('cancel'),
              },
            }}
          />
          <ProductPager
            page={shown.page}
            pages={shown.pages}
            q={query.q}
            category={selected?.key ?? ''}
            texts={{
              label: t('pagination'),
              status: t('pageOf', { page: shown.page, pages: shown.pages }),
              previous: t('previous'),
              next: t('next'),
            }}
          />
        </>
      )}
    </>
  );
}
