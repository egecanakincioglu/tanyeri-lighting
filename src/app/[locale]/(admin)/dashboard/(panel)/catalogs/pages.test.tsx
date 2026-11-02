import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditCatalogPage from './[id]/page.tsx';
import NewCatalogPage from './new/page.tsx';
import CatalogsAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listCatalogs: vi.fn(), listPromoBoards: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/catalogs.ts', () => ({ listCatalogs: mocks.listCatalogs }));
vi.mock('../../../../../../server/content/promo-boards.ts', () => ({ listPromoBoards: mocks.listPromoBoards }));
vi.mock('../../../../../../server/admin/catalogs-actions.ts', () => ({
  createCatalogAction: vi.fn(),
  updateCatalogAction: vi.fn(),
  deleteCatalogAction: vi.fn(),
  reorderCatalogsAction: vi.fn(),
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

const catalog = {
  id: 'k1',
  name: { tr: 'Genel katalog', en: 'General catalog' },
  pdfUrl: '/demo/general.pdf',
  coverImageUrl: '/demo/general.webp',
  sizeBytes: 3 * 1024 * 1024,
};
const board = (title: string, catalogId: string) => ({
  id: `b-${title}`,
  imageUrl: '/demo/area-otel.webp',
  title: { tr: `${title} tr`, en: title },
  catalogId,
  catalogName: catalog.name,
  catalogPdfUrl: catalog.pdfUrl,
});

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/catalogs'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/catalogs/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/catalogs/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('catalog screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listCatalogs.mockClear();
    mocks.listCatalogs.mockResolvedValue([catalog, { ...catalog, id: 'k2', name: { tr: 'Ikinci', en: 'Second' } }]);
    mocks.listPromoBoards.mockClear();
    mocks.listPromoBoards.mockResolvedValue([board('Winter board', 'k1'), board('Spring board', 'k1')]);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the catalogs with their size and a link to create one', async () => {
      inIntl('en', await CatalogsAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Catalogs');
      expect(screen.getByRole('link', { name: 'New catalog' }).getAttribute('href')).toBe('/en/admin/catalogs/new');
      expect(screen.getByText('Second')).toBeTruthy();
      expect(screen.getAllByText('3.0 MB')).toHaveLength(2);
      expect(screen.getByRole('link', { name: 'Edit: Second' }).getAttribute('href')).toBe('/en/admin/catalogs/k2');
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await CatalogsAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni katalog' }).getAttribute('href')).toBe(
        '/tr/yonetim/kataloglar/yeni',
      );
    });

    it('names the promo boards that use a catalog in its delete dialog, and only for that catalog', async () => {
      inIntl('en', await CatalogsAdminPage(listProps('en')));
      expect(document.body.textContent).toContain(
        '“General catalog” is used by the promo boards “Winter board”, “Spring board”.',
      );
      expect(document.body.textContent).toContain('“Second” will be deleted for good.');
    });

    it('turns reordering and deleting off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await CatalogsAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Second' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(CatalogsAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listCatalogs).not.toHaveBeenCalled();
      await expect(CatalogsAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await CatalogsAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form with the file and the cover fields, and says uploads are off without a file store', async () => {
      inIntl('en', await NewCatalogPage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New catalog');
      expect(screen.getByText('PDF file')).toBeTruthy();
      expect(screen.getByText('Cover image')).toBeTruthy();
      expect(screen.getAllByText(/File upload is off on this site/).length).toBeGreaterThan(0);
    });

    it('allows uploads when a file store is connected, and not in the demo', async () => {
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'x'.repeat(24));
      inIntl('en', await NewCatalogPage(newProps('en')));
      expect((screen.getAllByRole('button', { name: 'Choose a file' })[0] as HTMLButtonElement).disabled).toBe(false);
      expect(screen.getByText('PDF, up to 4 MB.')).toBeTruthy();
      cleanup();
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewCatalogPage(newProps('en')));
      expect((screen.getAllByRole('button', { name: 'Choose a file' })[0] as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewCatalogPage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewCatalogPage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored catalog and shows its PDF', async () => {
      inIntl('en', await EditCatalogPage(editProps('en', 'k2')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit catalog');
      expect((screen.getByLabelText('Turkish') as HTMLInputElement).value).toBe('Ikinci');
      expect(screen.getByRole('link', { name: 'Open the file' }).getAttribute('href')).toBe('/demo/general.pdf');
    });

    it('answers an id that does not exist with not found', async () => {
      await expect(EditCatalogPage(editProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditCatalogPage(editProps('en', 'k1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditCatalogPage(editProps('xx', 'k1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditCatalogPage(editProps('en', 'k1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
