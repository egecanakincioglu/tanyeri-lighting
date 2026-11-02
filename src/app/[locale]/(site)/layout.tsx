import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { routing } from '../../../i18n/routing.ts';
import { listCategories } from '../../../server/content/categories.ts';
import { getSiteSettings } from '../../../server/content/site-settings.ts';
import { isDemoMode } from '../../../server/env.ts';
import { Footer } from '../../../components/site/footer.tsx';
import { Header } from '../../../components/site/header.tsx';
import { VisitBeacon } from '../../../components/site/visit-beacon.tsx';

export default async function SiteLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  const language = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: 'Header' });
  const band = await getTranslations({ locale, namespace: 'DemoBand' });
  const [settings, categories] = await Promise.all([getSiteSettings(), listCategories()]);

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="fixed top-4 left-4 z-[60] -translate-y-24 rounded-sm bg-surface px-4 py-3 focus:translate-y-0"
      >
        {t('skip')}
      </a>
      {isDemoMode() && (
        <aside aria-label={band('label')} className="bg-accent-tint px-(--gutter) py-2 text-center text-sm text-ink">
          <p>{band('text')}</p>
        </aside>
      )}
      <Header
        logoUrl={settings.logoUrl}
        categories={categories.map((category) => ({ key: category.key, name: category.name[language] }))}
      />
      <main id="main" tabIndex={-1} data-page-region className="grow focus:outline-none">
        {children}
      </main>
      <Footer settings={settings} />
      <VisitBeacon />
    </div>
  );
}
