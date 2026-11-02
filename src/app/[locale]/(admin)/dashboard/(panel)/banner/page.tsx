import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BannerForm } from '../../../../../../components/admin/banner/banner-form.tsx';
import { commonFormProps } from '../../../../../../components/admin/form-common.ts';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../i18n/routing.ts';
import { updateBannerAction } from '../../../../../../server/admin/banner-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { getHomeBanner } from '../../../../../../server/content/home-banner.ts';
import { PAGE_KEYS } from '../../../../../../server/content/schemas.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/banner'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminBanner' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function BannerAdminPage({ params }: PageProps<'/[locale]/dashboard/banner'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, common, banner] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminBanner' }),
    commonFormProps(locale),
    getHomeBanner(),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <BannerForm
        action={updateBannerAction}
        initial={banner}
        targets={PAGE_KEYS.map((key) => ({ value: key, label: t(`pages.${key}`) }))}
        texts={{
          image: t('fieldImage'),
          title: t('fieldTitle'),
          description: t('fieldDescription'),
          primaryLabel: t('fieldPrimaryLabel'),
          primaryTarget: t('fieldPrimaryTarget'),
          secondaryLabel: t('fieldSecondaryLabel'),
          secondaryTarget: t('fieldSecondaryTarget'),
        }}
        {...common}
      />
    </>
  );
}
