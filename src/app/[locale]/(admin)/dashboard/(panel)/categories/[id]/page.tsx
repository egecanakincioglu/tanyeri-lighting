import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { categoryFormProps } from '../../../../../../../components/admin/categories/form-props.ts';
import { CategoryForm } from '../../../../../../../components/admin/categories/category-form.tsx';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updateCategoryAction } from '../../../../../../../server/admin/categories-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listCategories } from '../../../../../../../server/content/categories.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/categories/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminCategories' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditCategoryPage({ params }: PageProps<'/[locale]/dashboard/categories/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, categories] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCategories' }),
    categoryFormProps(locale),
    listCategories(),
  ]);
  // There are at most a few categories and no single-row reader, so the list is searched.
  const category = categories.find((item) => item.id === id);
  if (!category) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={category.name[locale]} />
      <CategoryForm action={updateCategoryAction} initial={category} {...props} />
    </>
  );
}
