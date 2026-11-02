import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { blogFormProps } from '../../../../../../../components/admin/blog/form-props.ts';
import { BlogForm } from '../../../../../../../components/admin/blog/blog-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { createPostAction } from '../../../../../../../server/admin/blog-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/blog/new'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminBlog' });
  return { title: t('createTitle'), robots: { index: false, follow: false } };
}

export default async function NewBlogPage({ params }: PageProps<'/[locale]/dashboard/blog/new'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props] = await Promise.all([getTranslations({ locale, namespace: 'AdminBlog' }), blogFormProps(locale)]);

  return (
    <>
      <PageHeader title={t('createTitle')} />
      <BlogForm action={createPostAction} {...props} />
    </>
  );
}
