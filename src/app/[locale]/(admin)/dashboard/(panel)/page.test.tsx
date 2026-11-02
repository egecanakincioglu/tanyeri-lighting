import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../test/axe.ts';
import PanelPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), getPanelCounts: vi.fn() }));

vi.mock('../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../server/admin/counts.ts', () => ({ getPanelCounts: mocks.getPanelCounts }));
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

describe('PanelPage', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getPanelCounts.mockClear();
    mocks.getPanelCounts.mockResolvedValue({
      products: 12,
      categories: 4,
      catalogs: 2,
      projects: 7,
      references: 9,
      services: 5,
      blogPosts: 6,
      messages: 3,
      unreadMessages: 2,
    });
  });
  afterEach(cleanup);

  it('shows a card with the count for each part of the content, linked to its screen', async () => {
    await renderPage('en');
    expect(mocks.guardPage).toHaveBeenCalledWith('en');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Dashboard');
    const references = screen.getByRole('link', { name: /References/ });
    expect(references.getAttribute('href')).toBe('/en/admin/references');
    expect(within(references).getByText('9')).toBeTruthy();
    expect(within(screen.getByRole('link', { name: /Blog/ })).getByText('6')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Products/ }).getAttribute('href')).toBe('/en/admin/products');
    expect(screen.getByRole('link', { name: /Messages/ }).textContent).toContain('2 unread');
  });

  it('shows the Turkish texts and addresses', async () => {
    await renderPage('tr');
    expect(mocks.guardPage).toHaveBeenCalledWith('tr');
    expect(screen.getByRole('link', { name: /Referanslar/ }).getAttribute('href')).toBe('/tr/yonetim/referanslar');
    expect(screen.getByRole('link', { name: 'Yeni referans' }).getAttribute('href')).toBe(
      '/tr/yonetim/referanslar/yeni',
    );
  });

  it('leaves out the unread note when every message was read', async () => {
    mocks.getPanelCounts.mockResolvedValue({ ...(await mocks.getPanelCounts()), unreadMessages: 0 });
    await renderPage('en');
    expect(screen.queryByText(/unread/)).toBeNull();
  });

  it('shows nothing to a visitor without a session: the guard redirects', async () => {
    mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
    await expect(PanelPage(props('en'))).rejects.toThrow('redirect:/en/admin/sign-in');
    expect(mocks.getPanelCounts).not.toHaveBeenCalled();
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
