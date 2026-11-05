import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { serviceFormProps } from '../../../../../../../components/admin/services/form-props.ts';
import { ServiceForm } from '../../../../../../../components/admin/services/service-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updateServiceAction } from '../../../../../../../server/admin/services-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listServices } from '../../../../../../../server/content/services.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/services/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminServices' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditServicePage({ params }: PageProps<'/[locale]/dashboard/services/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, services] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminServices' }),
    serviceFormProps(locale),
    listServices(),
  ]);
  // No single-row reader exists, so search the list.
  const service = services.find((item) => item.id === id);
  if (!service) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={service.title[locale]} />
      <ServiceForm action={updateServiceAction} initial={service} {...props} />
    </>
  );
}
