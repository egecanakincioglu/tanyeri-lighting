import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import '../globals.css';
import { isIndexingEnabled } from '../../server/env.ts';
import { routing } from '../../i18n/routing.ts';

export async function generateMetadata({ params }: Omit<LayoutProps<'/[locale]'>, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return isIndexingEnabled() ? { title: t('title') } : { title: t('title'), robots: { index: false, follow: false } };
}

export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  await connection();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
