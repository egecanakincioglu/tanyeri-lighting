import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JsonLd } from '../../../components/json-ld.tsx';
import { LegalView } from '../../../components/site/legal-view.tsx';
import { routing } from '../../../i18n/routing.ts';
import { toMetadata } from '../../../lib/page-metadata.ts';
import { pageAlternates } from '../../../lib/seo.ts';
import { breadcrumbData } from '../../../lib/structured-data.ts';
import { getLegalPage } from '../../../server/content/legal-pages.ts';
import { getPageMetadata } from '../../../server/content/page-metadata.ts';
import type { LegalPageKey } from '../../../server/content/schemas.ts';

const localeOf = (value: string) => (hasLocale(routing.locales, value) ? value : routing.defaultLocale);

// Shared by the privacy and terms pages. A page whose text was never saved answers 404, like the footer, which
// does not link to it.
export async function renderLegalPage(key: LegalPageKey, rawLocale: string) {
  const locale = localeOf(rawLocale);
  const [page, header] = await Promise.all([getLegalPage(key), getTranslations({ locale, namespace: 'Header' })]);
  if (!page) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbData(locale, [
          { name: header('home'), href: '/' },
          { name: page.title[locale], href: `/${key}` },
        ])}
      />
      <LegalView title={page.title[locale]} body={page.body[locale]} />
    </>
  );
}

export async function legalMetadata(key: LegalPageKey, rawLocale: string): Promise<Metadata> {
  const locale = localeOf(rawLocale);
  const [page, saved] = await Promise.all([getLegalPage(key), getPageMetadata(key)]);
  return { ...toMetadata(saved, locale, page?.title[locale]), alternates: pageAlternates(locale, `/${key}`) };
}
