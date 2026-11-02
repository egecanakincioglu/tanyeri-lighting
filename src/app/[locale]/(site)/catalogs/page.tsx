import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '../../../../components/button.tsx';
import { CatalogView } from '../../../../components/catalog-viewer/catalog-view.tsx';
import type { ViewerLabels } from '../../../../components/catalog-viewer/viewer-labels.ts';
import { Container } from '../../../../components/container.tsx';
import { JsonLd } from '../../../../components/json-ld.tsx';
import { SectionTitle } from '../../../../components/section-title.tsx';
import { SiteImage } from '../../../../components/site-image.tsx';
import { routing } from '../../../../i18n/routing.ts';
import { toMetadata } from '../../../../lib/page-metadata.ts';
import { pageSeo } from '../../../../lib/seo.ts';
import { breadcrumbData } from '../../../../lib/structured-data.ts';
import { listCatalogs } from '../../../../server/content/catalogs.ts';
import { getPageMetadata } from '../../../../server/content/page-metadata.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/catalogs'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const [t, page] = await Promise.all([getTranslations({ locale, namespace: 'Header' }), getPageMetadata('catalogs')]);
  return { ...toMetadata(page, locale, undefined, t('catalogs')), ...pageSeo(locale, '/catalogs') };
}

// One column up to 24rem wide, two up to 50rem, three up to 62rem; the page gutter is clamp(1rem, 4vw, 4rem). The 2x
// source of the widest cover (about 390 px) fits the 800 px file, so no column is wider than that.
const COVER_SIZES =
  '(min-width: 900px) 315px, (min-width: 540px) calc((min(100vw - 2 * clamp(1rem, 4vw, 4rem), 50rem) - 1.5rem) / 2), min(100vw - 2 * clamp(1rem, 4vw, 4rem), 24rem)';

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
      <JsonLd
        data={breadcrumbData(locale, [
          { name: header('home'), href: '/' },
          { name: header('catalogs'), href: '/catalogs' },
        ])}
      />
      <SectionTitle title={header('catalogs')} level={1} />
      {catalogs.length > 0 && (
        <Container>
          <ul className="mx-auto grid max-w-96 grid-cols-1 gap-6 xs:max-w-200 xs:grid-cols-2 wide:max-w-248 wide:grid-cols-3">
            {catalogs.map((catalog) => {
              const name = catalog.name[locale];
              const size = formatSize(catalog.sizeBytes, locale);
              return (
                <li key={catalog.id} className="group h-full">
                  <CatalogView
                    href={catalog.pdfUrl}
                    name={name}
                    detail={`PDF, ${size}`}
                    label={t('viewLabel', { name })}
                    labels={viewerLabels}
                    cover={
                      catalog.coverImageUrl ? (
                        <SiteImage src={catalog.coverImageUrl} alt="" fill sizes={COVER_SIZES} />
                      ) : (
                        <span className="flex size-full items-center justify-center bg-accent-tint p-6 text-center text-xl leading-tight font-bold text-ink">
                          {name}
                        </span>
                      )
                    }
                    download={
                      <ButtonLink
                        variant="outline"
                        href={catalog.pdfUrl}
                        download
                        prefetch={false}
                        aria-label={t('downloadLabel', { name, size })}
                      >
                        {t('download')}
                      </ButtonLink>
                    }
                  >
                    {t('view')}
                  </CatalogView>
                </li>
              );
            })}
          </ul>
        </Container>
      )}
    </div>
  );
}
