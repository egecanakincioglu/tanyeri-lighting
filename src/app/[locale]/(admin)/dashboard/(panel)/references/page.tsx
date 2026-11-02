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
import { deleteReferenceAction, reorderReferencesAction } from '../../../../../../server/admin/references-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listReferences } from '../../../../../../server/content/references.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/references'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminReferences' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ReferencesAdminPage({ params }: PageProps<'/[locale]/dashboard/references'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, references] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminReferences' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listReferences(),
  ]);
  const formTexts = buildFormTexts(form);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <ButtonLink href={getPathname({ locale, href: '/dashboard/references/new' })} prefetch={false}>
            {t('create')}
          </ButtonLink>
        }
      />
      <ResourceList
        locale={locale}
        rows={references.map((reference) => ({
          id: reference.id,
          title: reference.name,
          subtitle: reference.title[locale],
          imageUrl: reference.imageUrl,
          edit: { pathname: '/dashboard/references/[id]', params: { id: reference.id } },
        }))}
        reorder={reorderReferencesAction}
        deleteAction={deleteReferenceAction}
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
            body: t('deleteBody'),
            confirm: t('deleteConfirm'),
            working: t('deleting'),
            cancel: form('cancel'),
          },
        }}
      />
    </>
  );
}
