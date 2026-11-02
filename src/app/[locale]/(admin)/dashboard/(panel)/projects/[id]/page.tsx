import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { projectFormProps } from '../../../../../../../components/admin/projects/form-props.ts';
import { ProjectForm } from '../../../../../../../components/admin/projects/project-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updateProjectAction } from '../../../../../../../server/admin/projects-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { getProject } from '../../../../../../../server/content/projects.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/projects/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProjects' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditProjectPage({ params }: PageProps<'/[locale]/dashboard/projects/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, project] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProjects' }),
    projectFormProps(locale),
    getProject(id),
  ]);
  if (!project) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={project.title[locale]} />
      <ProjectForm action={updateProjectAction} initial={project} {...props} />
    </>
  );
}
