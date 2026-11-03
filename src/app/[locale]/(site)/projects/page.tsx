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
import { pageSeo } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';
import { listProjects } from '../../../../server/content/projects.ts';

// One project per row, at most 56 rem wide; below that the gutters are 4 vw (1 rem under 25 rem).
const sizes = '(min-width: 61rem) 56rem, (min-width: 25rem) 92vw, calc(100vw - 2rem)';

export async function generateMetadata({ params }: PageProps<'/[locale]/projects'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getPageMetadata('projects')]);
  return { ...toMetadata(page, locale, undefined, t('projects')), ...pageSeo(locale, '/projects') };
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
          <ul className="flex flex-col gap-14">
            {projects.map((project, index) => (
              <li key={project.id} className="mx-auto w-full max-w-4xl">
                <article className="flex flex-col gap-4">
                  <h2 className="text-xl leading-tight font-bold text-ink">{project.title[locale]}</h2>
                  <BeforeAfter
                    beforeUrl={project.beforeImageUrl}
                    afterUrl={project.afterImageUrl}
                    beforeLabel={t('before')}
                    afterLabel={t('after')}
                    label={t('compare')}
                    valueText={t.raw('valueText')}
                    name={project.title[locale]}
                    sizes={sizes}
                    eager={index === 0}
                  />
                  <div className="space-y-3 text-muted">
                    <MarkdownContent>{project.description[locale]}</MarkdownContent>
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
