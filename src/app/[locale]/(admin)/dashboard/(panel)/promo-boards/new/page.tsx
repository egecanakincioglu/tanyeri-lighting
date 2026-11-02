import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { promoFormProps } from '../../../../../../../components/admin/promo/form-props.ts';
import { PromoForm } from '../../../../../../../components/admin/promo/promo-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createPromoBoardAction } from '../../../../../../../server/admin/promo-boards-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/promo-boards/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminPromo' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewPromoBoardPage({ params }: PageProps<'/[locale]/dashboard/promo-boards/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([getTranslations({ locale, namespace: 'AdminPromo' }), promoFormProps(locale)]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <PromoForm action={createPromoBoardAction} {...props} />
    </>
  );
}
