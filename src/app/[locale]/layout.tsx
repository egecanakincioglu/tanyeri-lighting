import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import localFont from 'next/font/local';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import '../globals.css';
import { isIndexingEnabled } from '../../server/env.ts';
import { routing } from '../../i18n/routing.ts';

// Both files hold Latin plus the full Turkish alphabet, so each family needs a single file.
const archivo = localFont({
  src: '../fonts/Archivo-Variable.woff2',
  weight: '400 800',
  variable: '--font-archivo',
  display: 'swap',
});

// Not used by the placeholder pages yet; skipping the preload keeps the first screen to one font file.
const plexMono = localFont({
  src: '../fonts/TanyeriMono-Regular.woff2',
  weight: '400',
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});

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
    <html lang={locale} className={`${archivo.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
