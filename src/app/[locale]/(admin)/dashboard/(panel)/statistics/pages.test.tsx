import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import StatisticsAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), getVisitStats: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/visits/service.ts', () => ({ getVisitStats: mocks.getVisitStats }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const props = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/statistics'>;

const show = async (node: Promise<ReactNode>) => render(await node);

const stats = {
  days: [
    { day: '2026-11-01', visits: 1, views: 2 },
    { day: '2026-11-02', visits: 3, views: 7 },
  ],
  countries: [
    { country: 'TR', visits: 3, views: 8 },
    { country: null, visits: 1, views: 1 },
  ],
  totals: { visits: 4, views: 9 },
};

describe('statistics screen', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getVisitStats.mockResolvedValue(stats);
  });
  afterEach(() => {
    cleanup();
  });

  it('checks the session first and shows nothing without one', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect'));
    await expect(StatisticsAdminPage(props('en'))).rejects.toThrow('redirect');
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(mocks.getVisitStats).not.toHaveBeenCalled();
  });

  it('answers not-found for an unknown language', async () => {
    await expect(StatisticsAdminPage(props('de'))).rejects.toThrow('not-found');
    expect(mocks.guardPage).not.toHaveBeenCalled();
  });

  it('shows the totals, the newest day first and the countries, in English', async () => {
    await show(StatisticsAdminPage(props('en')));
    expect(screen.getByRole('heading', { level: 1, name: 'Statistics' })).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    const daily = screen.getByRole('table', { name: 'Per day' });
    const rows = within(daily).getAllByRole('row');
    expect(rows[1]?.textContent).toContain('Nov 2, 2026');
    expect(rows[2]?.textContent).toContain('Nov 1, 2026');
    const countries = within(screen.getByRole('table', { name: 'Countries' }));
    expect(countries.getByRole('rowheader', { name: 'Türkiye' })).toBeTruthy();
    expect(countries.getByRole('rowheader', { name: 'Unknown' })).toBeTruthy();
  });

  it('shows the Turkish labels and dates', async () => {
    await show(StatisticsAdminPage(props('tr')));
    expect(screen.getByRole('heading', { level: 1, name: 'İstatistikler' })).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Günlük' }).textContent).toContain('2 Kas 2026');
    expect(
      within(screen.getByRole('table', { name: 'Ülkeler' })).getByRole('rowheader', { name: 'Bilinmiyor' }),
    ).toBeTruthy();
  });

  it('shows an empty state instead of the tables when nothing was recorded', async () => {
    mocks.getVisitStats.mockResolvedValue({
      days: stats.days.map((day) => ({ ...day, visits: 0, views: 0 })),
      countries: [],
      totals: { visits: 0, views: 0 },
    });
    await show(StatisticsAdminPage(props('en')));
    expect(screen.getByText('No visits recorded in the last 30 days.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it.each(['tr', 'en'])('has no accessibility violations in %s', async (locale) => {
    const { container } = await show(StatisticsAdminPage(props(locale)));
    expect(await axeViolations(container)).toEqual([]);
  });

  it('sets a noindex title', async () => {
    expect(await generateMetadata(props('en'))).toEqual({
      title: 'Statistics',
      robots: { index: false, follow: false },
    });
  });
});
