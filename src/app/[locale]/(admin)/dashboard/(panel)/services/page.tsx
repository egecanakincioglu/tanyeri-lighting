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
import { deleteServiceAction, reorderServicesAction } from '../../../../../../server/admin/services-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listServices } from '../../../../../../server/content/services.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/services'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminServices' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ServicesAdminPage({ params }: PageProps<'/[locale]/dashboard/services'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, services] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminServices' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listServices(),
  ]);
  const formTexts = buildFormTexts(form);

  const create = (
    <ButtonLink href={getPathname({ locale, href: '/dashboard/services/new' })} prefetch={false}>
      {t('create')}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} action={create} />
      <ResourceList
        createAction={create}
        locale={locale}
        rows={services.map((service) => ({
          id: service.id,
          title: service.title[locale],
          imageUrl: service.imageUrl,
          edit: { pathname: '/dashboard/services/[id]', params: { id: service.id } },
        }))}
        reorder={reorderServicesAction}
        deleteAction={deleteServiceAction}
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
