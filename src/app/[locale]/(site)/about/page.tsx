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
import { pageAlternates } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { getAboutPage } from '../../../../server/content/about-page.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/about'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const [t, metadata] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getPageMetadata('about')]);
  const description = metadata?.description[locale];
  return {
    title: t('about'),
    ...(description ? { description } : {}),
    alternates: pageAlternates(locale, '/about'),
  };
}

export default async function AboutPage({ params }: PageProps<'/[locale]/about'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, about] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getAboutPage()]);
  const body = about.body[locale];

  return (
    <>
      <JsonLd
        data={breadcrumbData(locale, [
          { name: t('home'), href: '/' },
          { name: t('about'), href: '/about' },
        ])}
      />
      <SectionTitle title={t('about')} level={1} />
      {body ? (
        <div className="pb-[clamp(2rem,5vw,4rem)]">
          <Container>
            <div className="mx-auto max-w-3xl">
              <Card>
                <div className={`p-6 sm:p-12 ${PROSE}`}>
                  <MarkdownContent>{body}</MarkdownContent>
                </div>
              </Card>
            </div>
          </Container>
        </div>
      ) : null}
    </>
  );
}
