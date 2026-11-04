import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditReferencePage from './[id]/page.tsx';
import NewReferencePage from './new/page.tsx';
import ReferencesAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listReferences: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/references.ts', () => ({ listReferences: mocks.listReferences }));
vi.mock('../../../../../../server/admin/references-actions.ts', () => ({
  createReferenceAction: vi.fn(),
  updateReferenceAction: vi.fn(),
  deleteReferenceAction: vi.fn(),
  reorderReferencesAction: vi.fn(),
}));
vi.mock('../../../../../../server/admin/upload-actions.ts', () => ({ finalizeMediaAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const reference = {
  id: 'r1',
  imageUrl: '/demo/area-otel.webp',
  name: 'Alpha Hotel',
  title: { tr: 'Otel', en: 'Hotel' },
  description: { tr: 'Açıklama', en: 'Description text' },
};

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/references'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/references/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/references/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('reference screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listReferences.mockClear();
    mocks.listReferences.mockResolvedValue([reference, { ...reference, id: 'r2', name: 'Beta Villa' }]);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the references in the language of the page with a link to create one', async () => {
      inIntl('en', await ReferencesAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('References');
      expect(screen.getByRole('link', { name: 'New reference' }).getAttribute('href')).toBe('/en/admin/references/new');
      expect(screen.getByText('Alpha Hotel')).toBeTruthy();
      expect(screen.getAllByText('Hotel')).toHaveLength(2);
      expect(screen.getByRole('link', { name: 'Edit: Beta Villa' }).getAttribute('href')).toBe(
        '/en/admin/references/r2',
      );
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await ReferencesAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni referans' }).getAttribute('href')).toBe(
        '/tr/yonetim/referanslar/yeni',
      );
      expect(screen.getAllByText('Otel')).toHaveLength(2);
    });

    it('turns reordering and deleting off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await ReferencesAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Alpha Hotel' }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getAllByText(/In the demo/).length).toBeGreaterThan(0);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(ReferencesAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listReferences).not.toHaveBeenCalled();
      await expect(ReferencesAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await ReferencesAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form, and tells that uploads are off while there is no file store', async () => {
      inIntl('en', await NewReferencePage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New reference');
      expect((screen.getByLabelText('Company name') as HTMLInputElement).value).toBe('');
      expect(screen.getByText(/File upload is off on this site/)).toBeTruthy();
    });

    it('allows uploads when a file store is connected, and not in the demo', async () => {
      vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'x'.repeat(24));
      inIntl('en', await NewReferencePage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Choose a file' }) as HTMLButtonElement).disabled).toBe(false);
      cleanup();
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewReferencePage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Choose a file' }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewReferencePage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewReferencePage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored reference', async () => {
      inIntl('en', await EditReferencePage(editProps('en', 'r2')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit reference');
      expect((screen.getByLabelText('Company name') as HTMLInputElement).value).toBe('Beta Villa');
      expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe('Otel');
    });

    it('answers an id that does not exist with not found', async () => {
      await expect(EditReferencePage(editProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditReferencePage(editProps('en', 'r1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditReferencePage(editProps('xx', 'r1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditReferencePage(editProps('en', 'r1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
