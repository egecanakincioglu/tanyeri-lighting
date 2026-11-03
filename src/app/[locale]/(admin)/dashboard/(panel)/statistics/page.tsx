import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../../../components/admin/page-header.tsx';
import { routing } from '../../../../../../i18n/routing.ts';
import { guardPage } from '../../../../../../server/auth/guard.ts';
import { getVisitStats } from '../../../../../../server/visits/service.ts';

export async function generateMetadata({ params }: PageProps<'/[locale]/dashboard/statistics'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'AdminStats' });
  return { title: t('title'), robots: { index: false, follow: false } };
}

const cell = 'px-4 py-3 align-top';
const head = `${cell} text-left text-sm font-semibold text-muted`;

// The bar repeats the number next to it, so it is hidden from assistive technology.
function Views({ value, max }: { value: number; max: number }) {
  return (
    <>
      <span className="tabular-nums">{value}</span>
      <progress
        aria-hidden="true"
        value={value}
        max={Math.max(max, 1)}
        className="mt-1 block h-2 w-full overflow-hidden rounded-full accent-accent [&::-webkit-progress-bar]:bg-accent-tint [&::-webkit-progress-value]:bg-accent [&::-moz-progress-bar]:bg-accent"
      />
    </>
  );
}

export default async function StatisticsAdminPage({ params }: PageProps<'/[locale]/dashboard/statistics'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await guardPage(locale);
  const [t, stats] = await Promise.all([getTranslations({ locale, namespace: 'AdminStats' }), getVisitStats()]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const regions = new Intl.DisplayNames(locale, { type: 'region' });
  const days = [...stats.days].reverse();
  const maxDay = Math.max(0, ...days.map((day) => day.views));
  const maxCountry = Math.max(0, ...stats.countries.map((row) => row.views));

  return (
    <>
      <PageHeader title={t('title')} description={t('description')} />
      {stats.totals.views === 0 ? (
        <p className="rounded-lg border border-hairline bg-surface px-5 py-10 text-center text-muted">{t('empty')}</p>
      ) : (
        <div className="grid gap-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-hairline bg-surface p-5">
              <dt className="text-sm text-muted">
                {t('visits')} · {t('period')}
              </dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums">{stats.totals.visits}</dd>
              <dd className="mt-1 text-sm text-muted">{t('visitsHint')}</dd>
            </div>
            <div className="rounded-lg border border-hairline bg-surface p-5">
              <dt className="text-sm text-muted">
                {t('views')} · {t('period')}
              </dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums">{stats.totals.views}</dd>
            </div>
          </dl>

          <section
            aria-labelledby="stats-daily"
            className="overflow-hidden rounded-lg border border-hairline bg-surface"
          >
            <h2 id="stats-daily" className="px-4 pt-4 text-lg font-bold">
              {t('daily')}
            </h2>
            <table className="mt-2 w-full">
              <caption className="sr-only">{t('daily')}</caption>
              <thead>
                <tr className="border-y border-hairline bg-page/60">
                  <th scope="col" className={head}>
                    {t('date')}
                  </th>
                  <th scope="col" className={head}>
                    {t('visits')}
                  </th>
                  <th scope="col" className={`${head} w-1/2`}>
                    {t('views')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {days.map((day) => (
                  <tr key={day.day} className="transition-colors hover:bg-page/60 motion-reduce:transition-none">
                    <th scope="row" className={`${cell} text-left font-normal whitespace-nowrap`}>
                      <time dateTime={day.day}>{date.format(new Date(`${day.day}T00:00:00Z`))}</time>
                    </th>
                    <td className={`${cell} tabular-nums`}>{day.visits}</td>
                    <td className={cell}>
                      <Views value={day.views} max={maxDay} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section
            aria-labelledby="stats-countries"
            className="overflow-hidden rounded-lg border border-hairline bg-surface"
          >
            <h2 id="stats-countries" className="px-4 pt-4 text-lg font-bold">
              {t('countries')}
            </h2>
            <table className="mt-2 w-full">
              <caption className="sr-only">{t('countries')}</caption>
              <thead>
                <tr className="border-y border-hairline bg-page/60">
                  <th scope="col" className={head}>
                    {t('country')}
                  </th>
                  <th scope="col" className={head}>
                    {t('visits')}
                  </th>
                  <th scope="col" className={`${head} w-1/2`}>
                    {t('views')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {stats.countries.map((row) => (
                  <tr
                    key={row.country ?? 'unknown'}
                    className="transition-colors hover:bg-page/60 motion-reduce:transition-none"
                  >
                    <th scope="row" className={`${cell} text-left font-normal wrap-break-word`}>
                      {row.country ? (regions.of(row.country) ?? row.country) : t('unknown')}
                    </th>
                    <td className={`${cell} tabular-nums`}>{row.visits}</td>
                    <td className={cell}>
                      <Views value={row.views} max={maxCountry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </>
  );
}
