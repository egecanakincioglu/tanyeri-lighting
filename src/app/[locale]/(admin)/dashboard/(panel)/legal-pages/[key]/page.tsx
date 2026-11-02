import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LegalForm } from '../../../../../../../components/admin/legal/legal-form.tsx';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { buildFormTexts } from '../../../../../../../components/admin/texts.ts';
import { routing } from '../../../../../../../i18n/routing.ts';
import { saveLegalPageAction } from '../../../../../../../server/admin/legal-pages-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { getLegalPage } from '../../../../../../../server/content/legal-pages.ts';
import { legalPageKeySchema } from '../../../../../../../server/content/schemas.ts';
import { isDemoMode } from '../../../../../../../server/env.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/legal-pages/[key]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminLegal' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

const EMPTY = { tr: '', en: '' };

export default async function EditLegalPage({ params }: PageProps<'/[locale]/dashboard/legal-pages/[key]'>) {
  const { locale, key: rawKey } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const key = legalPageKeySchema.safeParse(rawKey);
  if (!key.success) notFound();
  const [t, form, markdown, page] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminLegal' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    getTranslations({ locale, namespace: 'AdminMarkdown' }),
    getLegalPage(key.data),
  ]);
  const formTexts = buildFormTexts(form);

  return (
    <>
      <PageHeader title={t('editTitle')} description={t(key.data)} />
      <LegalForm
        action={saveLegalPageAction}
        pageKey={key.data}
        initial={{ title: page?.title ?? EMPTY, body: page?.body ?? EMPTY }}
        texts={{ title: t('fieldTitle'), body: t('fieldBody'), hideNote: t('hideNote'), cancel: form('cancel') }}
        markdownTexts={{
          hint: markdown('hint'),
          edit: markdown('edit'),
          preview: markdown('preview'),
          loading: markdown('loading'),
        }}
        formTexts={formTexts}
        readOnlyReason={isDemoMode() ? formTexts.demoNote : undefined}
      />
    </>
  );
}
