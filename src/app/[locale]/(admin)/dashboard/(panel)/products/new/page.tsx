import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { productFormProps } from '../../../../../../../components/admin/products/form-props.ts';
import { ProductForm } from '../../../../../../../components/admin/products/product-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createProductAction } from '../../../../../../../server/admin/products-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listCategories } from '../../../../../../../server/content/categories.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/products/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProducts' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewProductPage({ params }: PageProps<'/[locale]/dashboard/products/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, categories] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProducts' }),
    listCategories(),
  ]);
  if (categories.length === 0) notFound();
  const props = await productFormProps(locale, categories);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <ProductForm action={createProductAction} {...props} />
    </>
  );
}
