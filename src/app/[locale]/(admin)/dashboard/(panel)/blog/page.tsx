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
import { deletePostAction } from '../../../../../../server/admin/blog-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listPosts } from '../../../../../../server/content/blog.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/blog'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminBlog' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function BlogAdminPage({ params }: PageProps<'/[locale]/dashboard/blog'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, posts] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminBlog' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listPosts(),
  ]);
  const formTexts = buildFormTexts(form);
  // A draft has no date; a date after today is an article that visitors do not see yet.
  const status = (date: Date | null) => {
    if (!date) return t('draft');
    const day = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(date);
    return t(date > new Date() ? 'scheduled' : 'publishedOn', { date: day });
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <ButtonLink href={getPathname({ locale, href: '/dashboard/blog/new' })} prefetch={false}>
            {t('create')}
          </ButtonLink>
        }
      />
      <ResourceList
        locale={locale}
        rows={posts.map((post) => ({
          id: post.id,
          title: post.title[locale],
          subtitle: status(post.publishedAt),
          imageUrl: post.imageUrl,
          edit: { pathname: '/dashboard/blog/[id]', params: { id: post.id } },
        }))}
        deleteAction={deletePostAction}
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
