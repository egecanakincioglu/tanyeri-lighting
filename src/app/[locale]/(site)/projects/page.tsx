import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Container } from '../../../../components/container.tsx';
import { MarkdownContent } from '../../../../components/markdown-content.tsx';
import { BeforeAfter } from '../../../../components/projects/before-after.tsx';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageAlternates } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';
import { listProjects } from '../../../../server/content/projects.ts';

// One column up to 900 px, capped at 30 rem so the 1000 px demo photos stay sharp on 2x screens; then two columns.
// The page width is fixed from 1440 px.
const sizes =
  '(min-width: 150rem) 786px, (min-width: 120rem) 706px, (min-width: 90rem) 642px, (min-width: 81.5rem) 586px, (min-width: 56.25rem) calc(46vw - 0.875rem), (min-width: 32.625rem) 30rem, (min-width: 25rem) 92vw, calc(100vw - 2rem)';

export async function generateMetadata({ params }: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getPageMetadata('projects')]);
  return { ...toMetadata(page, locale, undefined, t('projects')), alternates: pageAlternates(locale, '/projects') };
}

export default async function ProjectsPage({ params }: PageProps<'/[locale]/projects'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [header, t, projects] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getTranslations({ locale, namespace: 'Projects' }),
    listProjects(),
  ]);

  return (
    <div className="pb-[clamp(2.5rem,6vw,4.5rem)]">
      <JsonLd
        data={breadcrumbData(locale, [
          { name: header('home'), href: '/' },
          { name: header('projects'), href: '/projects' },
        ])}
      />
      <SectionTitle title={header('projects')} level={1} />
      {projects.length > 0 && (
        <Container>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted">{t('intro')}</p>
          <ul className="grid grid-cols-1 gap-x-7 gap-y-14 wide:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id} className="mx-auto w-full max-w-[30rem] wide:max-w-none">
                <article className="flex flex-col gap-4">
                  <h2 className="text-xl leading-tight font-bold text-ink">{project.title[locale]}</h2>
                  <div className="order-2 space-y-3 text-muted wide:order-3">
                    <MarkdownContent>{project.description[locale]}</MarkdownContent>
                  </div>
                  <div className="order-3 wide:order-2">
                    <BeforeAfter
                      beforeUrl={project.beforeImageUrl}
                      afterUrl={project.afterImageUrl}
                      beforeLabel={t('before')}
                      afterLabel={t('after')}
                      label={t('compare')}
                      valueText={t.raw('valueText')}
                      name={project.title[locale]}
                      sizes={sizes}
                    />
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </div>
  );
}
