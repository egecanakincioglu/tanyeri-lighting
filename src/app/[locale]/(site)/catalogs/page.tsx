import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '../../../../components/button.tsx';
import { CatalogView } from '../../../../components/catalog-viewer/catalog-view.tsx';
import type { ViewerLabels } from '../../../../components/catalog-viewer/viewer-labels.ts';
import { Card } from '../../../../components/card.tsx';
import { Container } from '../../../../components/container.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { routing } from '../../../../i18n/routing.ts';
import { listCatalogs } from '../../../../server/content/catalogs.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/catalogs'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getPageMetadata('catalogs')]);
  const description = page?.description[locale];
  return description ? { title: t('catalogs'), description } : { title: t('catalogs') };
}

function formatSize(bytes: number, locale: string): string {
  const [unit, divisor] =
    bytes < 1000
      ? (['byte', 1] as const)
      : bytes < 1_000_000
        ? (['kilobyte', 1000] as const)
        : (['megabyte', 1_000_000] as const);
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }).format(
    bytes / divisor,
  );
}

export default async function CatalogsPage({ params }: PageProps<'/[locale]/catalogs'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [header, t, catalogs] = await Promise.all([
    getTranslations({ locale, namespace: 'Header' }),
    getTranslations({ locale, namespace: 'Catalogs' }),
    listCatalogs(),
  ]);

  // The viewer fills in the numbers while it runs, so the templates keep their placeholders.
  const viewerLabels: ViewerLabels = {
    close: t('viewerClose'),
    previous: t('viewerPrevious'),
    next: t('viewerNext'),
    page: t('viewerPage', { page: '{page}', total: '{total}' }),
    pages: t('viewerPages', { from: '{from}', to: '{to}', total: '{total}' }),
    loading: t('viewerLoading'),
    error: t('viewerError'),
    download: t('viewerDownload'),
    book: t('viewerBook', { name: '{name}' }),
  };

  return (
    <div className="pb-[clamp(2.5rem,6vw,4.5rem)]">
      <SectionTitle title={header('catalogs')} level={1} />
      {catalogs.length > 0 && (
        <Container>
          <ul className="mx-auto flex max-w-3xl flex-col gap-4">
            {catalogs.map((catalog) => {
              const name = catalog.name[locale];
              const size = formatSize(catalog.sizeBytes, locale);
              return (
                <li key={catalog.id}>
                  <Card>
                    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                      <div>
                        <h2 className="text-xl leading-tight font-bold text-ink">{name}</h2>
                        <p className="mt-1 text-[0.95rem] text-muted">PDF, {size}</p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <CatalogView
                          href={catalog.pdfUrl}
                          name={name}
                          label={t('viewLabel', { name })}
                          labels={viewerLabels}
                        >
                          {t('view')}
                        </CatalogView>
                        <ButtonLink
                          variant="outline"
                          href={catalog.pdfUrl}
                          download
                          prefetch={false}
                          aria-label={t('downloadLabel', { name, size })}
                        >
                          {t('download')}
                        </ButtonLink>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </Container>
      )}
    </div>
  );
}
