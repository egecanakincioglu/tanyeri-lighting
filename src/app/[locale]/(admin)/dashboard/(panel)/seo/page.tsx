import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { Link } from '../../../../../../i18n/navigation.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { getPageMetadata } from '../../../../../../server/content/page-metadata.ts';
import { PAGE_KEYS } from '../../../../../../server/content/schemas.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/seo'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminSeo' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function SeoAdminPage({ params }: PageProps<'/[locale]/dashboard/seo'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, pages] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminSeo' }),
    Promise.all(PAGE_KEYS.map(async (key) => ({ key, metadata: await getPageMetadata(key) }))),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
        {pages.map(({ key, metadata }) => (
          <li key={key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-muted">{t(`pages.${key}`)}</p>
              {metadata ? (
                <>
                  <p className="font-semibold wrap-break-word">{metadata.title[locale]}</p>
                  <p className="line-clamp-2 text-sm wrap-break-word text-muted">{metadata.description[locale]}</p>
                </>
              ) : (
                <p className="text-muted">{t('notSet')}</p>
              )}
            </div>
            <Link
              prefetch={false}
              href={{ pathname: '/dashboard/seo/[key]', params: { key } }}
              aria-label={`${t('edit')}: ${t(`pages.${key}`)}`}
              className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
            >
              {t('edit')}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
