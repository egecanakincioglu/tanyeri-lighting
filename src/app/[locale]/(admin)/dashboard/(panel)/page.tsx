import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { VisitBars } from '../../../../../components/admin/dashboard/visit-bars.tsx';
import { PageHeader } from '../../../../../components/admin/page-header.tsx';
import { Link } from '../../../../../i18n/navigation.ts';
import type { StaticPath } from '../../../../../i18n/routing.ts';
import { routing } from '../../../../../i18n/routing.ts';
import { getPanelCounts, type PanelCounts } from '../../../../../server/admin/counts.ts';
import { getMissingContent } from '../../../../../server/admin/missing-content.ts';
import { guardPage } from '../../../../../server/auth/guard.ts';
import { listMessages } from '../../../../../server/contact/service.ts';
import { getVisitStats } from '../../../../../server/visits/service.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminHome' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const LATEST_MESSAGES = 5;
const TOP_COUNTRIES = 5;
const TOTALS: readonly (keyof PanelCounts)[] = [
  'products',
  'categories',
  'catalogs',
  'projects',
  'references',
  'services',
  'blogPosts',
  'messages',
];
const QUICK: readonly { id: string; href: StaticPath }[] = [
  { id: 'newProduct', href: '/dashboard/products/new' },
  { id: 'newPost', href: '/dashboard/blog/new' },
  { id: 'newProject', href: '/dashboard/projects/new' },
  { id: 'newReference', href: '/dashboard/references/new' },
];

const box = 'min-w-0 rounded-lg border border-hairline bg-surface p-5';
const rowLink = 'flex min-h-touch items-center gap-3 rounded-md px-2 py-2 hover:bg-page';

function Box({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${box} flex flex-col`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="text-lg font-bold">
          {title}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

const textLink =
  'inline-flex min-h-touch flex-none items-center rounded-md px-1 text-sm whitespace-nowrap font-semibold text-accent-text hover:underline';

export default async function PanelPage({ params }: PageProps<'/[locale]/dashboard'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, counts, missing, stats, latest] = await Promise.all([
    getTranslations({ locale, namespace: 'AdminHome' }),
    getPanelCounts(),
    getMissingContent(),
    getVisitStats(),
    listMessages({ limit: LATEST_MESSAGES }),
  ]);

  const dayFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const messageDate = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'Europe/Istanbul' });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const regions = new Intl.DisplayNames(locale, { type: 'region' });
  const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`));

  const unread = counts.unreadMessages;
  const peak = stats.days.reduce((best, day) => (day.views > best.views ? day : best), stats.days[0]!);

  const tiles: { id: string; value: number; href: StaticPath; highlight?: boolean }[] = [
    { id: 'visitors', value: stats.totals.visits, href: '/dashboard/statistics' },
    { id: 'views', value: stats.totals.views, href: '/dashboard/statistics' },
    { id: 'unread', value: unread, href: '/dashboard/messages', highlight: unread > 0 },
    { id: 'drafts', value: missing.draftPosts, href: '/dashboard/blog' },
  ];

  const images = missing.imagesWithoutDescription;
  const missingRows: { id: string; value: number; href: StaticPath }[] = [
    { id: 'productsNoDescription', value: missing.productsWithoutDescription, href: '/dashboard/products' },
    { id: 'productsNoSpecs', value: missing.productsWithoutTechnicalValue, href: '/dashboard/products' },
    { id: 'drafts', value: missing.draftPosts, href: '/dashboard/blog' },
    { id: 'imagesServices', value: images.services, href: '/dashboard/services' },
    { id: 'imagesAreas', value: images.applicationAreas, href: '/dashboard/application-areas' },
    { id: 'imagesReferences', value: images.references, href: '/dashboard/references' },
    { id: 'imagesBoards', value: images.promoBoards, href: '/dashboard/promo-boards' },
    { id: 'imagesCatalogs', value: images.catalogs, href: '/dashboard/catalogs' },
    { id: 'imagesBanner', value: images.homeBanner, href: '/dashboard/banner' },
  ];
  const openRows = missingRows.filter((row) => row.value > 0);

  const shown = stats.countries.slice(0, TOP_COUNTRIES).map((row) => ({
    key: row.country ?? 'unknown',
    label: row.country ? (regions.of(row.country) ?? row.country) : t('countries.unknown'),
    views: row.views,
  }));
  const otherViews = stats.countries.slice(TOP_COUNTRIES).reduce((sum, row) => sum + row.views, 0);
  if (otherViews > 0) shown.push({ key: 'other', label: t('countries.other'), views: otherViews });

  return (
    <>
      <PageHeader
        title={t('greeting')}
        description={unread === 0 ? t('unreadNone') : t(unread === 1 ? 'unreadOne' : 'unreadMany', { count: unread })}
      />

      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map(({ id, value, href, highlight }) => (
          <li key={id} className="min-w-0">
            <Link
              prefetch={false}
              href={href}
              className={`flex h-full min-h-28 flex-col justify-between gap-2 rounded-lg border bg-surface p-4 transition-colors hover:border-accent motion-reduce:transition-none sm:p-5 ${highlight ? 'border-accent' : 'border-hairline'}`}
            >
              <span className="text-sm font-semibold text-muted">{t(`tiles.${id}`)}</span>
              <span className={`text-3xl font-bold tabular-nums ${highlight ? 'text-accent-text' : ''}`}>{value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 [&>section]:h-full">
          <Box
            id="home-visits"
            title={t('chart.title')}
            action={
              <Link prefetch={false} href="/dashboard/statistics" className={textLink}>
                {t('chart.more')}
              </Link>
            }
          >
            {stats.totals.views === 0 ? (
              <p className="py-10 text-center text-muted">{t('chart.empty')}</p>
            ) : (
              <VisitBars
                bars={stats.days.map((day) => ({
                  day: day.day,
                  views: day.views,
                  title: t('chart.day', { date: formatDay(day.day), views: day.views, visits: day.visits }),
                }))}
                summary={t('chart.summary', {
                  views: stats.totals.views,
                  peak: peak.views,
                  date: formatDay(peak.day),
                })}
                startLabel={formatDay(stats.days[0]!.day)}
                endLabel={formatDay(stats.days.at(-1)!.day)}
              />
            )}
          </Box>
        </div>
        <div className="lg:col-span-2 [&>section]:h-full">
          <Box
            id="home-messages"
            title={t('messages.title')}
            action={
              <Link prefetch={false} href="/dashboard/messages" className={textLink}>
                {t('messages.all')}
              </Link>
            }
          >
            {latest.items.length === 0 ? (
              <p className="text-muted">{t('messages.empty')}</p>
            ) : (
              <ul className="-mx-2">
                {latest.items.map((message) => (
                  <li key={message.id}>
                    <Link
                      prefetch={false}
                      href={{ pathname: '/dashboard/messages/[id]', params: { id: message.id } }}
                      className={rowLink}
                    >
                      <span className="flex size-2 flex-none items-center justify-center" aria-hidden="true">
                        {!message.readAt && <span className="size-2 rounded-full bg-accent" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate ${message.readAt ? 'font-semibold' : 'font-bold'}`}>
                            {message.name}
                          </span>
                          <time dateTime={message.createdAt.toISOString()} className="flex-none text-xs text-muted">
                            {messageDate.format(message.createdAt)}
                          </time>
                        </span>
                        <span className="block truncate text-sm text-muted">{message.subject || message.message}</span>
                        {!message.readAt && <span className="sr-only">{t('messages.unread')}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Box>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Box id="home-missing" title={t('missing.title')}>
          {openRows.length === 0 ? (
            <p className="text-muted">{t('missing.none')}</p>
          ) : (
            <ul className="-mx-2">
              {openRows.map(({ id, value, href }) => (
                <li key={id}>
                  <Link prefetch={false} href={href} className={rowLink}>
                    <span className="w-10 flex-none rounded-full bg-accent-tint px-2 py-0.5 text-center text-sm font-bold text-accent-text tabular-nums">
                      {value}
                    </span>
                    <span className="min-w-0 flex-1 wrap-break-word">{t(`missing.rows.${id}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Box>
        <Box id="home-countries" title={t('countries.title')}>
          {shown.length === 0 ? (
            <p className="text-muted">{t('countries.empty')}</p>
          ) : (
            <ul className="grid gap-3">
              {shown.map((row) => (
                <li key={row.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 wrap-break-word">{row.label}</span>
                    <span className="flex-none tabular-nums text-muted">
                      {percent.format(row.views / stats.totals.views)}
                    </span>
                  </div>
                  <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-accent-tint">
                    <div
                      className={`h-full rounded-full ${row.key === 'other' ? 'bg-muted' : 'bg-accent'}`}
                      style={{ width: `${Math.round((row.views / stats.totals.views) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Box>
      </div>

      <section aria-labelledby="home-quick" className="mt-6">
        <h2 id="home-quick" className="mb-3 text-lg font-bold">
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

      <p className="mt-8 text-sm text-muted">{TOTALS.map((id) => `${t(`cards.${id}`)}: ${counts[id]}`).join(' · ')}</p>
    </>
  );
}
