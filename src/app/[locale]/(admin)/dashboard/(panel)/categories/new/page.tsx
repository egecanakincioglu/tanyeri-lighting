import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { categoryFormProps } from '../../../../../../../components/admin/categories/form-props.ts';
import { CategoryForm } from '../../../../../../../components/admin/categories/category-form.tsx';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createCategoryAction } from '../../../../../../../server/admin/categories-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/categories/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminCategories' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewCategoryPage({ params }: PageProps<'/[locale]/dashboard/categories/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCategories' }),
    categoryFormProps(locale),
  ]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <CategoryForm action={createCategoryAction} {...props} />
    </>
  );
}
