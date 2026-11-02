import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { promoFormProps } from '../../../../../../../components/admin/promo/form-props.ts';
import { PromoForm } from '../../../../../../../components/admin/promo/promo-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updatePromoBoardAction } from '../../../../../../../server/admin/promo-boards-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { listPromoBoards } from '../../../../../../../server/content/promo-boards.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/promo-boards/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminPromo' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditPromoBoardPage({ params }: PageProps<'/[locale]/dashboard/promo-boards/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, boards] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminPromo' }),
    promoFormProps(locale),
    listPromoBoards(),
  ]);
  // There are only a few boards and no single-row reader, so the list is searched.
  const board = boards.find((item) => item.id === id);
  if (!board) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={board.title[locale]} />
      <PromoForm action={updatePromoBoardAction} initial={board} {...props} />
    </>
  );
}
