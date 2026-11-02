import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CatalogForm } from '../../../../../../../components/admin/catalogs/catalog-form.tsx';
import { catalogFormProps } from '../../../../../../../components/admin/catalogs/form-props.ts';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createCatalogAction } from '../../../../../../../server/admin/catalogs-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/catalogs/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminCatalogs' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewCatalogPage({ params }: PageProps<'/[locale]/dashboard/catalogs/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCatalogs' }),
    catalogFormProps(locale),
  ]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <CatalogForm action={createCatalogAction} {...props} />
    </>
  );
}
