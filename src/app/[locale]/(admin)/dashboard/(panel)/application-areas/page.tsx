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
  deleteApplicationAreaAction,
  reorderApplicationAreasAction,
} from '../../../../../../server/admin/application-areas-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listApplicationAreas } from '../../../../../../server/content/application-areas.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/dashboard/application-areas'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminAreas' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ApplicationAreasAdminPage({
  params,
}: PageProps<'/[locale]/dashboard/application-areas'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, areas] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminAreas' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listApplicationAreas(),
  ]);
  const formTexts = buildFormTexts(form);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <ButtonLink href={getPathname({ locale, href: '/dashboard/application-areas/new' })} prefetch={false}>
            {t('create')}
          </ButtonLink>
        }
      />
      <ResourceList
        locale={locale}
        rows={areas.map((area) => ({
          id: area.id,
          title: area.title[locale],
          subtitle: area.description[locale],
          imageUrl: area.imageUrl,
          edit: { pathname: '/dashboard/application-areas/[id]', params: { id: area.id } },
        }))}
        reorder={reorderApplicationAreasAction}
        deleteAction={deleteApplicationAreaAction}
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
