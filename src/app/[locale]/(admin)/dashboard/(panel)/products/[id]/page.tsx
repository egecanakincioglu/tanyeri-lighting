import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { productFormProps } from '../../../../../../../components/admin/products/form-props.ts';
import { ProductForm } from '../../../../../../../components/admin/products/product-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updateProductAction } from '../../../../../../../server/admin/products-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listCategories } from '../../../../../../../server/content/categories.ts';
import { listProducts } from '../../../../../../../server/content/products.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/products/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProducts' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditProductPage({ params }: PageProps<'/[locale]/dashboard/products/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, categories, products] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProducts' }),
    listCategories(),
    listProducts(),
  ]);
  // There is no single-row reader, so the list is searched.
  const product = products.find((item) => item.id === id);
  if (!product) notFound();
  const props = await productFormProps(locale, categories);

  return (
    <>
      <PageHeader title={t('editTitle')} description={product.name[locale]} />
      <ProductForm action={updateProductAction} initial={product} {...props} />
    </>
  );
}
