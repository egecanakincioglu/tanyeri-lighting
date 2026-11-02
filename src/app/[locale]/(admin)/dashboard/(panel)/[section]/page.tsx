import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { itemKeyOfSection } from '../../../../../../components/admin/nav.ts';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../i18n/routing.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';

// The one page behind every menu item that has no screen of its own yet. A screen replaces it by adding a page file
// at its own folder, which takes precedence over this dynamic one.
async function titleOf(locale: string, section: string): Promise<string | undefined> {
  const key = itemKeyOfSection(section);
  if (!key) return undefined;
  const t = await getTranslations({ locale, namespace: 'AdminNav' });
  return t(`items.${key}`);
}

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/[section]'>): Promise<Metadata> {
  const { locale, section } = await params;
  return { title: await titleOf(locale, section), robots: { index: false, follow: false } };
}

export default async function SectionPage({ params }: PageProps<'/[locale]/dashboard/[section]'>) {
  const { locale, section } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const title = await titleOf(locale, section);
  if (!title) notFound();
  const t = await getTranslations({ locale, namespace: 'AdminNav' });

  return (
    <>
      <PageHeader title={title} />
      <p className="rounded-lg border border-hairline bg-surface px-5 py-10 text-center text-muted">
        {t('comingNext')}
      </p>
    </>
  );
}
