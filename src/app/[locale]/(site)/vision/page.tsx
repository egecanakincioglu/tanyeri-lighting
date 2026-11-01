import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Card } from '../../../../components/card.tsx';
import { Container } from '../../../../components/container.tsx';
import { MarkdownContent } from '../../../../components/markdown-content.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { PROSE } from '../../../../components/site/prose.ts';
import { routing } from '../../../../i18n/routing.ts';
import { getAboutPage } from '../../../../server/content/about-page.ts';

// The vision text is stored with the about page and has no metadata entry of its own.
export async function generateMetadata({ params }: PageProps<'/[locale]/vision'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'Header' });
  return { title: t('vision') };
}

export default async function VisionPage({ params }: PageProps<'/[locale]/vision'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, about] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getAboutPage()]);
  const vision = about.vision[locale];

  return (
    <>
      <SectionTitle title={t('vision')} level={1} />
      {vision ? (
        <div className="pb-[clamp(2rem,5vw,4rem)]">
          <Container>
            <div className="mx-auto max-w-3xl">
              <Card>
                <div className={`p-6 text-center sm:p-12 ${PROSE}`}>
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
