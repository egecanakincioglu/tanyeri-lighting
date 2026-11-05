import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { referenceFormProps } from '../../../../../../../components/admin/references/form-props.ts';
import { ReferenceForm } from '../../../../../../../components/admin/references/reference-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updateReferenceAction } from '../../../../../../../server/admin/references-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listReferences } from '../../../../../../../server/content/references.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/references/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminReferences' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditReferencePage({ params }: PageProps<'/[locale]/dashboard/references/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, references] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminReferences' }),
    referenceFormProps(locale),
    listReferences(),
  ]);
  // No single-row reader exists, so search the list.
  const reference = references.find((item) => item.id === id);
  if (!reference) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={reference.name} />
      <ReferenceForm action={updateReferenceAction} initial={reference} {...props} />
    </>
  );
}
