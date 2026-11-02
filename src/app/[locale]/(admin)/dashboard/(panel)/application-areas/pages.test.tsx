import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditApplicationAreaPage from './[id]/page.tsx';
import NewApplicationAreaPage from './new/page.tsx';
import ApplicationAreasAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listApplicationAreas: vi.fn(), update: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/application-areas.ts', () => ({
  listApplicationAreas: mocks.listApplicationAreas,
}));
vi.mock('../../../../../../server/admin/application-areas-actions.ts', () => ({
  createApplicationAreaAction: vi.fn(),
  updateApplicationAreaAction: mocks.update,
  deleteApplicationAreaAction: vi.fn(),
  reorderApplicationAreasAction: vi.fn(),
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

const area = {
  id: 'a1',
  imageUrl: '/demo/area-konut.webp',
  title: { tr: 'Konut', en: 'Homes' },
  description: { tr: 'Konut açıklaması', en: 'Homes text' },
};

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/application-areas'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/application-areas/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/application-areas/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('application area screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listApplicationAreas.mockClear();
    mocks.listApplicationAreas.mockResolvedValue([area, { ...area, id: 'a2', title: { tr: 'Ofis', en: 'Offices' } }]);
    mocks.update.mockClear();
    mocks.update.mockResolvedValue({ status: 'success' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the areas in the language of the page with a link to create one', async () => {
      inIntl('en', await ApplicationAreasAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Application Areas');
      expect(screen.getByRole('link', { name: 'New area' }).getAttribute('href')).toBe(
        '/en/admin/application-areas/new',
      );
      expect(screen.getAllByText('Homes text')).toHaveLength(2);
      expect(screen.getByRole('link', { name: 'Edit: Offices' }).getAttribute('href')).toBe(
        '/en/admin/application-areas/a2',
      );
    });

    it('is Turkish at the Turkish address, off in the demo, and kept out of search results', async () => {
      inIntl('tr', await ApplicationAreasAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni alan' }).getAttribute('href')).toBe(
        '/tr/yonetim/calisma-alanlari/yeni',
      );
      cleanup();
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await ApplicationAreasAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Homes' }) as HTMLButtonElement).disabled).toBe(true);
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(ApplicationAreasAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listApplicationAreas).not.toHaveBeenCalled();
      await expect(ApplicationAreasAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await ApplicationAreasAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form and turns saving off in the demo', async () => {
      inIntl('en', await NewApplicationAreaPage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New application area');
      expect((document.getElementById('title-en') as HTMLInputElement).value).toBe('');
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
      cleanup();
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewApplicationAreaPage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewApplicationAreaPage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewApplicationAreaPage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored area and sends it on save', async () => {
      inIntl('en', await EditApplicationAreaPage(editProps('en', 'a2')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit application area');
      expect((document.getElementById('title-en') as HTMLInputElement).value).toBe('Offices');
      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
      });
      expect(Object.fromEntries(mocks.update.mock.calls[0]![1].entries())).toMatchObject({
        id: 'a2',
        'title.en': 'Offices',
        'description.en': 'Homes text',
      });
    });

    it('shows the error under the field and keeps what was typed', async () => {
      mocks.update.mockResolvedValue({
        status: 'error',
        code: 'invalid',
        fieldErrors: { 'description.en': { code: 'tooLong', max: 300 }, imageUrl: { code: 'invalid' } },
      });
      inIntl('en', await EditApplicationAreaPage(editProps('en', 'a1')));
      fireEvent.change(document.getElementById('description-en')!, { target: { value: 'Typed' } });
      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
      });
      expect(document.getElementById('description-en-error')?.textContent).toBe('At most 300 characters.');
      expect((document.getElementById('description-en') as HTMLTextAreaElement).value).toBe('Typed');
    });

    it('answers an id that does not exist with not found, and refuses a visitor without a session', async () => {
      await expect(EditApplicationAreaPage(editProps('en', 'gone'))).rejects.toThrow('not-found');
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditApplicationAreaPage(editProps('en', 'a1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditApplicationAreaPage(editProps('xx', 'a1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditApplicationAreaPage(editProps('en', 'a1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
