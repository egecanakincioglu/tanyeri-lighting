import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FeaturedEditor } from '../../../../../../components/admin/featured/featured-editor.tsx';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { buildFormTexts } from '../../../../../../components/admin/texts.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import { saveFeaturedProductsAction } from '../../../../../../server/admin/featured-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listFeaturedProducts } from '../../../../../../server/content/featured-products.ts';
import { listProducts } from '../../../../../../server/content/products.ts';
import { FEATURED_LIMIT, type Product } from '../../../../../../server/content/schemas.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/featured-products'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminFeatured' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function FeaturedProductsAdminPage({
  params,
}: PageProps<'/[locale]/dashboard/featured-products'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, featured, products] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminFeatured' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listFeaturedProducts(),
    listProducts(),
  ]);
  const formTexts = buildFormTexts(form);
  const item = (product: Product) => ({
    id: product.id,
    name: product.name[locale],
    code: product.code,
    imageUrl: product.imageUrl,
  });

  return (
    <>
      <PageHeader title={t('title')} description={t('description', { max: FEATURED_LIMIT })} />
      <FeaturedEditor
        initial={featured.map(item)}
        products={products.map(item)}
        limit={FEATURED_LIMIT}
        save={saveFeaturedProductsAction}
        formTexts={formTexts}
        disabledReason={isDemoMode() ? formTexts.demoNote : undefined}
        texts={{
          current: t('current'),
          counter: t('counter'),
          empty: t('empty'),
          moveUp: t('moveUp'),
          moveDown: t('moveDown'),
          remove: t('remove'),
          add: t('add'),
          search: t('search'),
          noMatch: t('noMatch'),
          full: t('full', { max: FEATURED_LIMIT }),
          refine: t('refine'),
        }}
      />
    </>
  );
}
