import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AreaForm } from '../../../../../../../components/admin/areas/area-form.tsx';
import { areaFormProps } from '../../../../../../../components/admin/areas/form-props.ts';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createApplicationAreaAction } from '../../../../../../../server/admin/application-areas-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/application-areas/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminAreas' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewApplicationAreaPage({
  params,
}: PageProps<'/[locale]/dashboard/application-areas/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([getTranslations({ locale, namespace: 'AdminAreas' }), areaFormProps(locale)]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <AreaForm action={createApplicationAreaAction} {...props} />
    </>
  );
}
