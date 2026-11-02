import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { SeoForm } from '../../../../../../../components/admin/seo/seo-form.tsx';
import { buildFormTexts } from '../../../../../../../components/admin/texts.ts';
import { routing } from '../../../../../../../i18n/routing.ts';
import { savePageMetadataAction } from '../../../../../../../server/admin/page-metadata-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { getPageMetadata } from '../../../../../../../server/content/page-metadata.ts';
import { pageKeySchema } from '../../../../../../../server/content/schemas.ts';
import { isDemoMode } from '../../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/seo/[key]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminSeo' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

const EMPTY = { tr: '', en: '' };

export default async function EditSeoPage({ params }: PageProps<'/[locale]/dashboard/seo/[key]'>) {
  const { locale, key: rawKey } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const key = pageKeySchema.safeParse(rawKey);
  if (!key.success) notFound();
  const [t, form, metadata] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminSeo' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getPageMetadata(key.data),
  ]);
  const formTexts = buildFormTexts(form);

  return (
    <>
      <PageHeader title={t('editTitle')} description={t(`pages.${key.data}`)} />
      <SeoForm
        action={savePageMetadataAction}
        pageKey={key.data}
        initial={{ title: metadata?.title ?? EMPTY, description: metadata?.description ?? EMPTY }}
        texts={{
          title: t('fieldTitle'),
          description: t('fieldDescription'),
          counter: t('counter', { count: '{count}', max: '{max}' }),
          counterOver: t('counterOver', { count: '{count}', max: '{max}' }),
          cancel: form('cancel'),
        }}
        formTexts={formTexts}
        readOnlyReason={isDemoMode() ? formTexts.demoNote : undefined}
      />
    </>
  );
}
