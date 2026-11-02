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
import { deleteProjectAction, reorderProjectsAction } from '../../../../../../server/admin/projects-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listProjects } from '../../../../../../server/content/projects.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/projects'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProjects' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ProjectsAdminPage({ params }: PageProps<'/[locale]/dashboard/projects'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, projects] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProjects' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listProjects(),
  ]);
  const formTexts = buildFormTexts(form);

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <ButtonLink href={getPathname({ locale, href: '/dashboard/projects/new' })} prefetch={false}>
            {t('create')}
          </ButtonLink>
        }
      />
      <ResourceList
        locale={locale}
        rows={projects.map((project) => ({
          id: project.id,
          title: project.title[locale],
          imageUrl: project.afterImageUrl,
          edit: { pathname: '/dashboard/projects/[id]', params: { id: project.id } },
        }))}
        reorder={reorderProjectsAction}
        deleteAction={deleteProjectAction}
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
