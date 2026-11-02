import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { Link } from '../../../../../../i18n/navigation.ts';
import { routing } from '../../../../../../i18n/routing.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { getLegalPage } from '../../../../../../server/content/legal-pages.ts';
import { LEGAL_PAGE_KEYS } from '../../../../../../server/content/schemas.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/legal-pages'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminLegal' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function LegalPagesAdminPage({ params }: PageProps<'/[locale]/dashboard/legal-pages'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, pages] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminLegal' }),
    Promise.all(LEGAL_PAGE_KEYS.map(async (key) => ({ key, page: await getLegalPage(key) }))),
  ]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
        {pages.map(({ key, page }) => (
          <li key={key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <p className="font-semibold wrap-break-word">{page ? page.title[locale] : t(key)}</p>
              <p className={`text-sm ${page ? 'text-success' : 'text-muted'}`}>{page ? t('published') : t('hidden')}</p>
            </div>
            <Link
              prefetch={false}
              href={{ pathname: '/dashboard/legal-pages/[key]', params: { key } }}
              aria-label={`${t('edit')}: ${page ? page.title[locale] : t(key)}`}
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
