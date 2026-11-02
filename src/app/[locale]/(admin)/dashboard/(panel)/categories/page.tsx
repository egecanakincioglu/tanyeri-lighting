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
import { deleteCategoryAction, reorderCategoriesAction } from '../../../../../../server/admin/categories-actions.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { listCategories } from '../../../../../../server/content/categories.ts';
import { MAX_CATEGORIES } from '../../../../../../server/content/schemas.ts';
import { isDemoMode } from '../../../../../../server/env.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/categories'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminCategories' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function CategoriesAdminPage({ params }: PageProps<'/[locale]/dashboard/categories'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, form, categories] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminCategories' }),
    getTranslations({ locale, namespace: 'AdminForm' }),
    listCategories(),
  ]);
  const formTexts = buildFormTexts(form);
  const full = categories.length >= MAX_CATEGORIES;

  return (
    <>
      <PageHeader
        title={t('title')}
        description={t('description', { max: MAX_CATEGORIES })}
        action={
          full ? undefined : (
            <ButtonLink href={getPathname({ locale, href: '/dashboard/categories/new' })} prefetch={false}>
              {t('create')}
            </ButtonLink>
          )
        }
      />
      <p className={`mb-4 text-sm font-medium ${full ? 'text-error' : 'text-muted'}`}>
        {full
          ? t('limitReached', { max: MAX_CATEGORIES })
          : t('usage', { count: categories.length, max: MAX_CATEGORIES })}
      </p>
      <ResourceList
        locale={locale}
        rows={categories.map((category) => ({
          id: category.id,
          title: category.name[locale],
          subtitle: category.key,
          edit: { pathname: '/dashboard/categories/[id]', params: { id: category.id } },
        }))}
        reorder={reorderCategoriesAction}
        deleteAction={deleteCategoryAction}
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
