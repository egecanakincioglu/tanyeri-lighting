import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AboutForm } from '../../../../../../components/admin/corporate/about-form.tsx';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { buildFormTexts } from '../../../../../../components/admin/texts.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import { updateAboutPageAction } from '../../../../../../server/admin/corporate-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { getAboutPage } from '../../../../../../server/content/about-page.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/about'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminAbout' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function AboutAdminPage({ params }: PageProps<'/[locale]/dashboard/about'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, markdown, about] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminAbout' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMarkdown' }),
    getAboutPage(),
  ]);
  const formTexts = buildFormTexts(form);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <AboutForm
        action={updateAboutPageAction}
        initial={about}
        formTexts={formTexts}
        readOnlyReason={isDemoMode() ? formTexts.demoNote : undefined}
        texts={{
          body: t('fieldBody'),
          vision: t('fieldVision'),
          markdown: {
            hint: markdown('hint'),
            edit: markdown('edit'),
            preview: markdown('preview'),
            loading: markdown('loading'),
          },
        }}
      />
    </>
  );
}
