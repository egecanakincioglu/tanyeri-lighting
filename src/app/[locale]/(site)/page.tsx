import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Banner } from '../../../components/home/banner.tsx';
import { Highlights } from '../../../components/home/highlights.tsx';
import { WorkAreas } from '../../../components/home/work-areas.tsx';
import { routing } from '../../../i18n/routing.ts';
import { listApplicationAreas } from '../../../server/content/application-areas.ts';
import { listFeaturedProducts } from '../../../server/content/featured-products.ts';
import { getHomeBanner } from '../../../server/content/home-banner.ts';
import { getPageMetadata } from '../../../server/content/page-metadata.ts';
import { listPromoBoards } from '../../../server/content/promo-boards.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const page = await getPageMetadata('home');
  const description = page?.description[locale];
  return description ? { description } : {};
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [t, banner, boards, products, areas] = await Promise.all([
    getTranslations({ locale, namespace: 'Home' }),
    getHomeBanner(),
    listPromoBoards(),
    listFeaturedProducts(),
    listApplicationAreas(),
  ]);

  // Scaled and tilted cards must never widen the page.
  return (
    <div className="overflow-x-clip">
      <Banner banner={banner} locale={locale} />
      <Highlights
        title={t('highlightsTitle')}
        boardLabel={t('boardLink')}
        boards={boards}
        products={products}
        locale={locale}
      />
      <WorkAreas title={t('areasTitle')} areas={areas} locale={locale} />
    </div>
  );
}
