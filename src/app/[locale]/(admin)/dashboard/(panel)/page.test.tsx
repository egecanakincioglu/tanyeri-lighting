import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../test/axe.ts';
import PanelPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({
  guardPage: vi.fn(),
  getPanelCounts: vi.fn(),
  getMissingContent: vi.fn(),
  getVisitStats: vi.fn(),
  listMessages: vi.fn(),
}));

vi.mock('../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../server/admin/counts.ts', () => ({ getPanelCounts: mocks.getPanelCounts }));
vi.mock('../../../../../server/admin/missing-content.ts', () => ({ getMissingContent: mocks.getMissingContent }));
vi.mock('../../../../../server/visits/service.ts', () => ({ getVisitStats: mocks.getVisitStats }));
vi.mock('../../../../../server/contact/service.ts', () => ({ listMessages: mocks.listMessages }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../test/translations.ts')).getTranslations,
}));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard'>;

async function renderPage(locale: 'tr' | 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {await PanelPage(props(locale))}
    </NextIntlClientProvider>,
  );
}

const counts = {
  products: 12,
  categories: 4,
  catalogs: 2,
  projects: 7,
  references: 9,
  services: 5,
  blogPosts: 6,
  messages: 3,
  unreadMessages: 2,
};
const noMissing = {
  productsWithoutDescription: 0,
  productsWithoutTechnicalValue: 0,
  draftPosts: 0,
  imagesWithoutDescription: {
    services: 0,
    applicationAreas: 0,
    references: 0,
    promoBoards: 0,
    catalogs: 0,
    homeBanner: 0,
  },
};

function statsWith(views: number[], countries: { country: string | null; views: number }[] = [], totalViews?: number) {
  const days = views.map((count, index) => ({
    day: `2026-10-${String(index + 1).padStart(2, '0')}`,
    visits: count > 0 ? 1 : 0,
    views: count,
  }));
  const total = totalViews ?? views.reduce((sum, count) => sum + count, 0);
  return {
    days,
    countries: countries.map((row) => ({ ...row, visits: 1 })),
    totals: { visits: 14, views: total },
  };
}

const thirtyDays = Array.from({ length: 30 }, (_, index) => (index === 9 ? 9 : index % 3));

const message = (id: string, name: string, subject: string, readAt: Date | null) => ({
  id,
  name,
  email: 'a@example.com',
  subject,
  message: 'Body text',
  locale: 'tr',
  createdAt: new Date('2026-10-20T10:00:00Z'),
  readAt,
});

describe('PanelPage', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getPanelCounts.mockClear();
    mocks.getPanelCounts.mockResolvedValue(counts);
    mocks.getMissingContent.mockClear();
    mocks.getMissingContent.mockResolvedValue({
      ...noMissing,
      productsWithoutDescription: 3,
      draftPosts: 2,
      imagesWithoutDescription: { ...noMissing.imagesWithoutDescription, references: 4 },
    });
    mocks.getVisitStats.mockClear();
    mocks.getVisitStats.mockResolvedValue(
      statsWith(
        thirtyDays,
        [
          { country: 'TR', views: 50 },
          { country: 'DE', views: 20 },
          { country: 'US', views: 10 },
          { country: 'FR', views: 5 },
          { country: null, views: 4 },
          { country: 'NL', views: 3 },
          { country: 'IT', views: 3 },
        ],
        100,
      ),
    );
    mocks.listMessages.mockClear();
    mocks.listMessages.mockResolvedValue({
      items: [
        message('m1', 'Deniz', 'Offer for a hotel', null),
        message('m2', 'Mert', 'Catalog request', new Date('2026-10-20T11:00:00Z')),
      ],
      nextCursor: null,
    });
  });
  afterEach(cleanup);

  it('greets with the unread state: many, one and none', async () => {
    await renderPage('en');
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Hello');
    expect(screen.getByText('You have 2 unread messages.')).toBeTruthy();
    cleanup();
    mocks.getPanelCounts.mockResolvedValue({ ...counts, unreadMessages: 1 });
    await renderPage('en');
    expect(screen.getByText('You have 1 unread message.')).toBeTruthy();
    cleanup();
    mocks.getPanelCounts.mockResolvedValue({ ...counts, unreadMessages: 0 });
    await renderPage('en');
    expect(screen.getByText('No unread messages. All caught up.')).toBeTruthy();
  });

  it('shows four tiles, each linked to its screen', async () => {
    await renderPage('en');
    const visitors = screen.getByRole('link', { name: /Visitors/ });
    expect(visitors.getAttribute('href')).toBe('/en/admin/statistics');
    expect(within(visitors).getByText('14')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Page views/ }).getAttribute('href')).toBe('/en/admin/statistics');
    const unread = screen.getByRole('link', { name: /Unread messages/ });
    expect(unread.getAttribute('href')).toBe('/en/admin/messages');
    expect(within(unread).getByText('2')).toBeTruthy();
    const drafts = screen.getByRole('link', { name: /Draft blog posts/ });
    expect(drafts.getAttribute('href')).toBe('/en/admin/blog');
    expect(within(drafts).getByText('2')).toBeTruthy();
  });

  it('draws the visit chart with a text summary, a hover title per day and a link to the statistics', async () => {
    await renderPage('en');
    const chart = screen.getByRole('img', { name: /Page views per day over the last 30 days/ });
    expect(chart.getAttribute('aria-label')).toContain('the busiest day was Oct 10 with 9');
    expect(chart.querySelectorAll('[title]')).toHaveLength(30);
    expect(chart.querySelector('[title="Oct 10: 9 page views, 1 visitors"]')).not.toBeNull();
    const box = screen.getByRole('heading', { level: 2, name: 'Visits, last 30 days' }).closest('section')!;
    expect(within(box).getByRole('link', { name: 'Statistics' }).getAttribute('href')).toBe('/en/admin/statistics');
  });

  it('says plainly when there are no visits', async () => {
    mocks.getVisitStats.mockResolvedValue(statsWith(new Array<number>(30).fill(0)));
    await renderPage('en');
    expect(screen.getByText('No visits recorded in the last 30 days.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('No country data yet.')).toBeTruthy();
  });

  it('lists the latest messages with an unread mark and a link to see all', async () => {
    await renderPage('en');
    const box = screen.getByRole('heading', { level: 2, name: 'Latest messages' }).closest('section')!;
    const first = within(box).getByRole('link', { name: /Deniz/ });
    expect(first.getAttribute('href')).toBe('/en/admin/messages/m1');
    expect(first.textContent).toContain('Offer for a hotel');
    expect(within(first).getByText('Unread')).toBeTruthy();
    expect(within(within(box).getByRole('link', { name: /Mert/ })).queryByText('Unread')).toBeNull();
    expect(within(box).getByRole('link', { name: 'See all' }).getAttribute('href')).toBe('/en/admin/messages');
    expect(mocks.listMessages).toHaveBeenCalledWith({ limit: 5 });
  });

  it('says so when there are no messages', async () => {
    mocks.listMessages.mockResolvedValue({ items: [], nextCursor: null });
    await renderPage('en');
    expect(screen.getByText('No messages yet.')).toBeTruthy();
  });

  it('shows only the missing content that has a count, each row linked to where it is fixed', async () => {
    await renderPage('en');
    const box = screen.getByRole('heading', { level: 2, name: 'Missing content' }).closest('section')!;
    const rows = within(box).getAllByRole('link');
    expect(rows.map((row) => row.textContent)).toEqual([
      '3Products without a description',
      '2Unpublished blog drafts',
      '4References without an image description',
    ]);
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/en/admin/products',
      '/en/admin/blog',
      '/en/admin/references',
    ]);
  });

  it('shows a positive line when nothing is missing', async () => {
    mocks.getMissingContent.mockResolvedValue(noMissing);
    await renderPage('en');
    expect(screen.getByText('Nothing is missing. All done.')).toBeTruthy();
  });

  it('shows the top five countries with their share and the rest as Other', async () => {
    await renderPage('en');
    const box = screen.getByRole('heading', { level: 2, name: 'Countries' }).closest('section')!;
    const rows = within(box)
      .getAllByRole('listitem')
      .map((row) => row.textContent);
    expect(rows).toEqual(['Türkiye50%', 'Germany20%', 'United States10%', 'France5%', 'Unknown4%', 'Other6%']);
  });

  it('offers the quick actions and a quiet line of totals', async () => {
    await renderPage('en');
    expect(screen.getByRole('link', { name: 'New product' }).getAttribute('href')).toBe('/en/admin/products/new');
    expect(screen.getByRole('link', { name: 'New blog post' }).getAttribute('href')).toBe('/en/admin/blog/new');
    expect(screen.getByRole('link', { name: 'New project' }).getAttribute('href')).toBe('/en/admin/projects/new');
    expect(screen.getByRole('link', { name: 'New reference' }).getAttribute('href')).toBe('/en/admin/references/new');
    expect(screen.getByText(/^Products: 12 · Categories: 4 · /).textContent).toContain('Messages: 3');
  });

  it('keeps one h1 and an h2 for each box', async () => {
    await renderPage('en');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Visits, last 30 days',
      'Latest messages',
      'Missing content',
      'Countries',
      'Quick actions',
    ]);
  });

  it('shows the Turkish texts and addresses', async () => {
    await renderPage('tr');
    expect(mocks.guardPage).toHaveBeenCalledWith('tr');
    expect(screen.getByText('2 okunmamış mesajın var.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Yeni referans' }).getAttribute('href')).toBe(
      '/tr/yonetim/referanslar/yeni',
    );
    expect(screen.getByRole('link', { name: /Okunmamış mesaj/ }).getAttribute('href')).toBe('/tr/yonetim/mesajlar');
  });

  it('shows nothing to a visitor without a session: the guard redirects', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(PanelPage(props('en'))).rejects.toThrow('redirect:/en/admin/sign-in');
    expect(mocks.getPanelCounts).not.toHaveBeenCalled();
    expect(mocks.getVisitStats).not.toHaveBeenCalled();
    expect(mocks.listMessages).not.toHaveBeenCalled();
  });

  it('answers an unknown language with not found before any session lookup', async () => {
    await expect(PanelPage(props('xx'))).rejects.toThrow('not-found');
    expect(mocks.guardPage).not.toHaveBeenCalled();
  });

  it('is kept out of search results', async () => {
    expect(await generateMetadata(props('tr'))).toMatchObject({ robots: { index: false, follow: false } });
  });

  it('has no axe violations', async () => {
    const { container } = await renderPage('en');
    expect(await axeViolations(container)).toEqual([]);
  });
});
