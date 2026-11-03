import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { buildFormTexts } from '../../../../../../components/admin/texts.ts';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { ResourceList } from '../../../../../../components/admin/resource-list.tsx';
import { ButtonLink } from '../../../../../../components/button.tsx';
import { getPathname } from '../../../../../../i18n/navigation.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import { deleteCatalogAction, reorderCatalogsAction } from '../../../../../../server/admin/catalogs-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listCatalogs } from '../../../../../../server/content/catalogs.ts';
import { listPromoBoards } from '../../../../../../server/content/promo-boards.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/catalogs'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminCatalogs' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function CatalogsAdminPage({ params }: PageProps<'/[locale]/dashboard/catalogs'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, catalogs, boards] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCatalogs' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listCatalogs(),
    listPromoBoards(),
  ]);
  const formTexts = buildFormTexts(form);

  // The dialog names the boards that use the catalog; `{name}` stays in the text for the dialog to fill in.
  const language = locale;
  function deleteBodyOf(catalogId: string): string | undefined {
    const titles = boards.filter((board) => board.catalogId === catalogId).map((board) => `“${board.title[language]}”`);
    return titles.length === 0 ? undefined : t('deleteBodyInUse', { name: '{name}', boards: titles.join(', ') });
  }

  const create = (
    <ButtonLink href={getPathname({ locale, href: '/dashboard/catalogs/new' })} prefetch={false}>
      {t('create')}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} action={create} />
      <ResourceList
        createAction={create}
        locale={locale}
        portraitImages
        rows={catalogs.map((catalog) => ({
          id: catalog.id,
          title: catalog.name[locale],
          subtitle: `${(catalog.sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
          imageUrl: catalog.coverImageUrl,
          deleteBody: deleteBodyOf(catalog.id),
          edit: { pathname: '/dashboard/catalogs/[id]', params: { id: catalog.id } },
        }))}
        reorder={reorderCatalogsAction}
        deleteAction={deleteCatalogAction}
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
