import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CatalogForm } from '../../../../../../../components/admin/catalogs/catalog-form.tsx';
import { catalogFormProps } from '../../../../../../../components/admin/catalogs/form-props.ts';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updateCatalogAction } from '../../../../../../../server/admin/catalogs-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listCatalogs } from '../../../../../../../server/content/catalogs.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/catalogs/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminCatalogs' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditCatalogPage({ params }: PageProps<'/[locale]/dashboard/catalogs/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, catalogs] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCatalogs' }),
    catalogFormProps(locale),
    listCatalogs(),
  ]);
  // No single-row reader exists, so search the list.
  const catalog = catalogs.find((item) => item.id === id);
  if (!catalog) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={catalog.name[locale]} />
      <CatalogForm action={updateCatalogAction} initial={catalog} {...props} />
    </>
  );
}
