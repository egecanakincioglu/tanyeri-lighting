import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { projectFormProps } from '../../../../../../../components/admin/projects/form-props.ts';
import { ProjectForm } from '../../../../../../../components/admin/projects/project-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createProjectAction } from '../../../../../../../server/admin/projects-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/projects/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminProjects' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewProjectPage({ params }: PageProps<'/[locale]/dashboard/projects/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminProjects' }),
    projectFormProps(locale),
  ]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <ProjectForm action={createProjectAction} {...props} />
    </>
  );
}
