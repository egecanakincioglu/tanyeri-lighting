import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AreaForm } from '../../../../../../../components/admin/areas/area-form.tsx';
import { areaFormProps } from '../../../../../../../components/admin/areas/form-props.ts';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updateApplicationAreaAction } from '../../../../../../../server/admin/application-areas-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listApplicationAreas } from '../../../../../../../server/content/application-areas.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/application-areas/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminAreas' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditApplicationAreaPage({
  params,
}: PageProps<'/[locale]/dashboard/application-areas/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, areas] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminAreas' }),
    areaFormProps(locale),
    listApplicationAreas(),
  ]);
  // There are only a few areas and no single-row reader, so the list is searched.
  const area = areas.find((item) => item.id === id);
  if (!area) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={area.title[locale]} />
      <AreaForm action={updateApplicationAreaAction} initial={area} {...props} />
    </>
  );
}
