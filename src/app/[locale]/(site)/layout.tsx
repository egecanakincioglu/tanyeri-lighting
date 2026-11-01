import { getTranslations } from 'next-intl/server';
import { Footer } from '../../../components/site/footer.tsx';
import { Header } from '../../../components/site/header.tsx';

export default async function SiteLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Header' });

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="fixed top-4 left-4 z-[60] -translate-y-24 rounded-sm bg-surface px-4 py-3 focus:translate-y-0"
      >
        {t('skip')}
      </a>
      <Header />
      <main id="main" tabIndex={-1} data-page-region className="grow focus:outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
