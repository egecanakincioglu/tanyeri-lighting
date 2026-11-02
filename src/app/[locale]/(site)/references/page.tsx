import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card } from '../../../../components/card.tsx';
import { Container } from '../../../../components/container.tsx';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { SiteImage } from '../../../../components/site-image.tsx';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageAlternates } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';
import { listReferences } from '../../../../server/content/references.ts';

// 1 column below 540 px, 2 up to 768 px, 3 up to 1280 px, then 5 as on the old page. The bare 18vw lets the browser pick the small widths; the page width is fixed from 1440 px.
const sizes =
  '(min-width: 150rem) 301px, (min-width: 120rem) 269px, (min-width: 90rem) 243px, (min-width: 81.5rem) 221px, (min-width: 80rem) 18vw, (min-width: 48rem) calc(30.67vw - 1rem), (min-width: 33.75rem) calc(46vw - 0.75rem), (min-width: 25rem) 92vw, calc(100vw - 2rem)';

export async function generateMetadata({ params }: PageProps<'/[locale]/references'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getPageMetadata('references'),
  ]);
  return { ...toMetadata(page, locale, undefined, t('references')), alternates: pageAlternates(locale, '/references') };
}

export default async function ReferencesPage({ params }: PageProps<'/[locale]/references'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [header, references] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), listReferences()]);

  return (
    <div className="pb-[clamp(2.5rem,6vw,4.5rem)]">
      <JsonLd
        data={breadcrumbData(locale, [
          { name: header('home'), href: '/' },
          { name: header('references'), href: '/references' },
        ])}
      />
      <SectionTitle title={header('references')} level={1} />
      {references.length > 0 && (
        <Container>
          <ul className="grid grid-cols-1 gap-6 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {references.map((reference) => (
              <li key={reference.id} className="h-full">
                <Card>
                  <div className="relative aspect-4/3 flex-none overflow-hidden">
                    <SiteImage src={reference.imageUrl} alt="" fill sizes={sizes} />
                  </div>
                  <div className="flex-1 px-4.5 pt-4 pb-5 wrap-break-word">
                    <h2 className="text-lg leading-tight font-bold text-ink">{reference.name}</h2>
                    <p className="mt-1 text-[0.95rem] font-semibold text-accent-text">{reference.title[locale]}</p>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{reference.description[locale]}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </div>
  );
}
