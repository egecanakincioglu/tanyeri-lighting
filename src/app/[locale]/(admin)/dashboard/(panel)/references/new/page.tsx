import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { referenceFormProps } from '../../../../../../../components/admin/references/form-props.ts';
import { ReferenceForm } from '../../../../../../../components/admin/references/reference-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createReferenceAction } from '../../../../../../../server/admin/references-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/references/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminReferences' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewReferencePage({ params }: PageProps<'/[locale]/dashboard/references/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminReferences' }),
    referenceFormProps(locale),
  ]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <ReferenceForm action={createReferenceAction} {...props} />
    </>
  );
}
