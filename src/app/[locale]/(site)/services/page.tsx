import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card } from '../../../../components/card.tsx';
import { Container } from '../../../../components/container.tsx';
import { MarkdownContent } from '../../../../components/markdown-content.tsx';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { SiteImage } from '../../../../components/site-image.tsx';
import { PROSE } from '../../../../components/site/prose.ts';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageSeo } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';
import { listServices } from '../../../../server/content/services.ts';

// Two columns from 600 px, one below; the widths follow the page container steps in globals.css.
const GUTTERS = '2 * clamp(1rem, 4vw, 4rem)';
const IMAGE_SIZES = [
  '(min-width: 150rem) 49rem',
  '(min-width: 120rem) 44rem',
  '(min-width: 90rem) 41rem',
  `(min-width: 37.5rem) calc((min(100vw - ${GUTTERS}, 75rem) - 1.5rem) / 2)`,
  `calc(100vw - ${GUTTERS})`,
].join(', ');

export async function generateMetadata({ params }: PageProps<'/[locale]/services'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [t, metadata] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getPageMetadata('services'),
  ]);
  return { ...toMetadata(metadata, locale, undefined, t('services')), ...pageSeo(locale, '/services') };
}

export default async function ServicesPage({ params }: PageProps<'/[locale]/services'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, services] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), listServices()]);

  return (
    <>
      <JsonLd
        data={breadcrumbData(locale, [
          { name: t('home'), href: '/' },
          { name: t('services'), href: '/services' },
        ])}
      />
      <SectionTitle title={t('services')} level={1} />
      {services.length > 0 ? (
        <div className="pb-[clamp(2rem,5vw,4rem)]">
          <Container>
            <ul className="grid gap-4 sm:gap-6 sm:grid-cols-2">
              {services.map((service) => {
                const note = service.note[locale];
                return (
                  <li key={service.id}>
                    <Card>
                      <div className="relative aspect-video overflow-hidden bg-page motion-safe:hover:[&_img]:scale-[1.08] [&_img]:transition-transform [&_img]:duration-[400ms]">
                        <SiteImage src={service.imageUrl} alt="" fill sizes={IMAGE_SIZES} />
                      </div>
                      <div className="flex grow flex-col gap-4 p-6">
                        <h2 className="text-2xl leading-tight font-bold text-ink">{service.title[locale]}</h2>
                        <div className={PROSE}>
                          <MarkdownContent>{service.description[locale]}</MarkdownContent>
                        </div>
                        {note ? <p className="mt-auto text-sm text-muted">{note}</p> : null}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </Container>
        </div>
      ) : null}
    </>
  );
}
