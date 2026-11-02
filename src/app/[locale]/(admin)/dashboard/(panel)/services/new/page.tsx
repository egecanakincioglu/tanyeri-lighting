import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { serviceFormProps } from '../../../../../../../components/admin/services/form-props.ts';
import { ServiceForm } from '../../../../../../../components/admin/services/service-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createServiceAction } from '../../../../../../../server/admin/services-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/services/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminServices' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewServicePage({ params }: PageProps<'/[locale]/dashboard/services/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminServices' }),
    serviceFormProps(locale),
  ]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <ServiceForm action={createServiceAction} {...props} />
    </>
  );
}
