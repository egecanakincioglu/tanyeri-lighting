import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../../components/admin/page-header.tsx';
import { blogFormProps } from '../../../../../../../components/admin/blog/form-props.ts';
import { BlogForm } from '../../../../../../../components/admin/blog/blog-form.tsx';
import { routing } from '../../../../../../../i18n/routing.ts';
import { updatePostAction } from '../../../../../../../server/admin/blog-actions.ts';
import { guardPage } from '../../../../../../../server/auth/guard.ts';
import { getPost } from '../../../../../../../server/content/blog.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/blog/[id]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminBlog' });
  return { title: t('editTitle'), robots: { index: false, follow: false } };
}

export default async function EditBlogPage({ params }: PageProps<'/[locale]/dashboard/blog/[id]'>) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, props, post] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminBlog' }),
    blogFormProps(locale),
    getPost(id),
  ]);
  if (!post) notFound();

  return (
    <>
      <PageHeader title={t('editTitle')} description={post.title[locale]} />
      <BlogForm
        action={updatePostAction}
        initial={{ ...post, publishedAt: post.publishedAt?.toISOString().slice(0, 10) ?? '' }}
        {...props}
      />
    </>
  );
}
