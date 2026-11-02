import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../components/admin/page-header.tsx';
import { Link } from '../../../../../i18n/navigation.ts';
import type { StaticPath } from '../../../../../i18n/routing.ts';
import { routing } from '../../../../../i18n/routing.ts';
import { getPanelCounts, type PanelCounts } from '../../../../../server/admin/counts.ts';
import { guardPage } from '../../../../../server/auth/guard.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminHome' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const CARDS: readonly { id: keyof PanelCounts; href: StaticPath }[] = [
  { id: 'products', href: '/dashboard/products' },
  { id: 'categories', href: '/dashboard/categories' },
  { id: 'catalogs', href: '/dashboard/catalogs' },
  { id: 'projects', href: '/dashboard/projects' },
  { id: 'references', href: '/dashboard/references' },
  { id: 'services', href: '/dashboard/services' },
  { id: 'blogPosts', href: '/dashboard/blog' },
  { id: 'messages', href: '/dashboard/messages' },
];

const QUICK: readonly { id: string; href: StaticPath }[] = [
  { id: 'newReference', href: '/dashboard/references/new' },
  { id: 'messages', href: '/dashboard/messages' },
  { id: 'site', href: '/' },
];

export default async function PanelPage({ params }: PageProps<'/[locale]/dashboard'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, counts] = await Promise.all([getTranslations({ locale, namespace: 'AdminHome' }), getPanelCounts()]);

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      <ul className="grid gap-4 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CARDS.map(({ id, href }) => (
          <li key={id}>
            <Link
              prefetch={false}
              href={href}
              className="flex h-full min-h-28 flex-col justify-between gap-2 rounded-lg border border-hairline bg-surface p-5 transition-colors hover:border-accent"
            >
              <span className="text-sm font-semibold text-muted">{t(`cards.${id}`)}</span>
              <span className="text-3xl font-bold tabular-nums">{counts[id]}</span>
              {id === 'messages' && counts.unreadMessages > 0 && (
                <span className="text-sm font-semibold text-accent-text">
                  {t('unread', { count: counts.unreadMessages })}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="quick-links" className="mt-8">
        <h2 id="quick-links" className="mb-3 text-lg font-bold">
          {t('quickTitle')}
        </h2>
        <div className="flex flex-wrap gap-3">
          {QUICK.map(({ id, href }) => (
            <Link
              key={id}
              prefetch={false}
              href={href}
              className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
            >
              {t(`quick.${id}`)}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
