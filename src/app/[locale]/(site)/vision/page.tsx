import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card } from '../../../../components/card.tsx';
import { Container } from '../../../../components/container.tsx';
import { MarkdownContent } from '../../../../components/markdown-content.tsx';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { PROSE } from '../../../../components/site/prose.ts';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageSeo } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { getAboutPage } from '../../../../server/content/about-page.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';

// The text is stored with the about page; the description is its own page-info entry.
export async function generateMetadata({ params }: PageProps<'/[locale]/vision'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [t, metadata] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getPageMetadata('vision'),
  ]);
  return { ...toMetadata(metadata, locale, undefined, t('vision')), ...pageSeo(locale, '/vision') };
}

export default async function VisionPage({ params }: PageProps<'/[locale]/vision'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, about] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getAboutPage()]);
  const vision = about.vision[locale];

  return (
    <>
      <JsonLd
        data={breadcrumbData(locale, [
          { name: t('home'), href: '/' },
          { name: t('vision'), href: '/vision' },
        ])}
      />
      <SectionTitle title={t('vision')} level={1} />
      {vision ? (
        <div className="pb-[clamp(2rem,5vw,4rem)]">
          <Container>
            <div className="mx-auto max-w-3xl">
              <Card>
                <div className={`p-6 sm:p-12 ${PROSE}`}>
                  <MarkdownContent>{vision}</MarkdownContent>
                </div>
              </Card>
            </div>
          </Container>
        </div>
      ) : null}
    </>
  );
}
