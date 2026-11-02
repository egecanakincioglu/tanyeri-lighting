import type { Metadata } from 'next';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import '../globals.css';
import { getSiteUrl, isIndexingEnabled } from '../../server/env.ts';
import { routing } from '../../i18n/routing.ts';

// One variable file holds Latin plus the full Turkish alphabet.
const figtree = localFont({
  src: '../fonts/Figtree-Variable.woff2',
  weight: '400 700',
  variable: '--font-figtree',
  display: 'swap',
});

export async function generateMetadata({ params }: Omit<LayoutProps<'/[locale]'>, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  const base = { metadataBase: getSiteUrl(), title: t('title') };
  return isIndexingEnabled() ? base : { ...base, robots: { index: false, follow: false } };
}

export default async function RootLayout({ children, params }: LayoutProps<'/[locale]'>) {
  await connection();
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <html lang={locale} className={`${figtree.variable}`}>
      <body>
        {/* The client components get their texts as props, so no messages are sent to the browser. */}
        <NextIntlClientProvider locale={locale} messages={null}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
