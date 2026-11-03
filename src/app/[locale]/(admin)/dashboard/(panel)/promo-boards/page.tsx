import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { ResourceList } from '../../../../../../components/admin/resource-list.tsx';
import { buildFormTexts } from '../../../../../../components/admin/texts.ts';
import { ButtonLink } from '../../../../../../components/button.tsx';
import { getPathname } from '../../../../../../i18n/navigation.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import {
  deletePromoBoardAction,
  reorderPromoBoardsAction,
} from '../../../../../../server/admin/promo-boards-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listPromoBoards } from '../../../../../../server/content/promo-boards.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/promo-boards'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminPromo' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function PromoBoardsAdminPage({ params }: PageProps<'/[locale]/dashboard/promo-boards'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, boards] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminPromo' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listPromoBoards(),
  ]);
  const formTexts = buildFormTexts(form);

  const create = (
    <ButtonLink href={getPathname({ locale, href: '/dashboard/promo-boards/new' })} prefetch={false}>
      {t('create')}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} action={create} />
      <ResourceList
        createAction={create}
        locale={locale}
        rows={boards.map((board) => ({
          id: board.id,
          title: board.title[locale],
          subtitle: board.catalogName[locale],
          imageUrl: board.imageUrl,
          edit: { pathname: '/dashboard/promo-boards/[id]', params: { id: board.id } },
        }))}
        reorder={reorderPromoBoardsAction}
        deleteAction={deletePromoBoardAction}
        formTexts={formTexts}
        disabledReason={isDemoMode() ? formTexts.demoNote : undefined}
        texts={{
          edit: t('edit'),
          moveUp: t('moveUp'),
          moveDown: t('moveDown'),
          empty: t('empty'),
          reordered: t('reordered'),
          delete: {
            trigger: t('delete'),
            title: t('deleteTitle'),
            body: t('deleteBody', { name: '{name}' }),
            confirm: t('deleteConfirm'),
            working: t('deleting'),
            cancel: form('cancel'),
          },
        }}
      />
    </>
  );
}
