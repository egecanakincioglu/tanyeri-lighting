import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditPromoBoardPage from './[id]/page.tsx';
import NewPromoBoardPage from './new/page.tsx';
import PromoBoardsAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({
  guardPage: vi.fn(),
  listPromoBoards: vi.fn(),
  listCatalogs: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/promo-boards.ts', () => ({ listPromoBoards: mocks.listPromoBoards }));
vi.mock('../../../../../../server/content/catalogs.ts', () => ({ listCatalogs: mocks.listCatalogs }));
vi.mock('../../../../../../server/admin/promo-boards-actions.ts', () => ({
  createPromoBoardAction: vi.fn(),
  updatePromoBoardAction: mocks.update,
  deletePromoBoardAction: vi.fn(),
  reorderPromoBoardsAction: vi.fn(),
}));
vi.mock('../../../../../../server/admin/upload-actions.ts', () => ({ uploadMediaAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const board = {
  id: 'b1',
  imageUrl: '/demo/promo-yasam.webp',
  title: { tr: 'Yaşam Alanları', en: 'Living Spaces' },
  subtitle: { tr: 'Sıcak ışık', en: 'Warm light' },
  catalogId: 'c2',
  catalogName: { tr: 'Dış mekan', en: 'Outdoor' },
  catalogPdfUrl: '/demo/catalog.pdf',
};
const catalogs = [
  { id: 'c1', name: { tr: 'Genel', en: 'General' } },
  { id: 'c2', name: { tr: 'Dış mekan', en: 'Outdoor' } },
];

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/promo-boards'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/promo-boards/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/promo-boards/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('promo board screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listPromoBoards.mockClear();
    mocks.listPromoBoards.mockResolvedValue([board, { ...board, id: 'b2', title: { tr: 'Dış Mekan', en: 'Outdoor' } }]);
    mocks.listCatalogs.mockClear();
    mocks.listCatalogs.mockResolvedValue(catalogs);
    mocks.update.mockClear();
    mocks.update.mockResolvedValue({ status: 'success' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the boards with the catalog they open and a link to create one', async () => {
      inIntl('en', await PromoBoardsAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Promo Boards');
      expect(screen.getByRole('link', { name: 'New board' }).getAttribute('href')).toBe('/en/admin/promo-boards/new');
      expect(screen.getByText('Living Spaces')).toBeTruthy();
      expect(screen.getAllByText('Outdoor').length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: 'Edit: Outdoor' }).getAttribute('href')).toBe(
        '/en/admin/promo-boards/b2',
      );
    });

    it('is Turkish at the Turkish address, off in the demo, and kept out of search results', async () => {
      inIntl('tr', await PromoBoardsAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni pano' }).getAttribute('href')).toBe(
        '/tr/yonetim/tanitim-panolari/yeni',
      );
      cleanup();
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await PromoBoardsAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Living Spaces' }) as HTMLButtonElement).disabled).toBe(true);
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(PromoBoardsAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listPromoBoards).not.toHaveBeenCalled();
      await expect(PromoBoardsAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await PromoBoardsAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form with the catalogs to choose from and an optional subtitle', async () => {
      inIntl('en', await NewPromoBoardPage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New promo board');
      const select = screen.getByLabelText('Catalog') as HTMLSelectElement;
      expect([...select.options].map((option) => option.text)).toEqual(['General', 'Outdoor']);
      expect((document.getElementById('subtitle-en') as HTMLInputElement).required).toBe(false);
      expect((document.getElementById('title-en') as HTMLInputElement).required).toBe(true);
    });

    it('asks for a catalog first when there is none, and cannot save', async () => {
      mocks.listCatalogs.mockResolvedValue([]);
      inIntl('en', await NewPromoBoardPage(newProps('en')));
      expect(screen.getByText(/Add a catalog first/)).toBeTruthy();
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('turns saving off in the demo and refuses a visitor without a session', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewPromoBoardPage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewPromoBoardPage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewPromoBoardPage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored board and sends it on save', async () => {
      inIntl('en', await EditPromoBoardPage(editProps('en', 'b1')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit promo board');
      expect((document.getElementById('subtitle-tr') as HTMLInputElement).value).toBe('Sıcak ışık');
      expect((screen.getByLabelText('Catalog') as HTMLSelectElement).value).toBe('c2');
      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
      });
      const sent = Object.fromEntries(mocks.update.mock.calls[0]![1].entries());
      expect(sent).toMatchObject({
        id: 'b1',
        'subtitle.en': 'Warm light',
        catalogId: 'c2',
        'title.tr': 'Yaşam Alanları',
      });
    });

    it('answers an id that does not exist with not found, and refuses a visitor without a session', async () => {
      await expect(EditPromoBoardPage(editProps('en', 'gone'))).rejects.toThrow('not-found');
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditPromoBoardPage(editProps('en', 'b1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditPromoBoardPage(editProps('xx', 'b1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditPromoBoardPage(editProps('en', 'b1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
