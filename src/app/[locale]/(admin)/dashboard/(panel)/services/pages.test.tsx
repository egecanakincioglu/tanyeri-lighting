import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditServicePage from './[id]/page.tsx';
import NewServicePage from './new/page.tsx';
import ServicesAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listServices: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/services.ts', () => ({ listServices: mocks.listServices }));
vi.mock('../../../../../../server/admin/services-actions.ts', () => ({
  createServiceAction: vi.fn(),
  updateServiceAction: vi.fn(),
  deleteServiceAction: vi.fn(),
  reorderServicesAction: vi.fn(),
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

const service = {
  id: 's1',
  imageUrl: '/demo/area-otel.webp',
  title: { tr: 'Aydınlatma', en: 'Lighting design' },
  description: { tr: 'Açıklama', en: 'Description text' },
  note: { tr: 'Not', en: 'Note text' },
};

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/services'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/services/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/services/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('service screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listServices.mockClear();
    mocks.listServices.mockResolvedValue([service, { ...service, id: 's2', title: { tr: 'Montaj', en: 'Fitting' } }]);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the services in the language of the page with a link to create one', async () => {
      inIntl('en', await ServicesAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Services');
      expect(screen.getByRole('link', { name: 'New service' }).getAttribute('href')).toBe('/en/admin/services/new');
      expect(screen.getByText('Lighting design')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Edit: Fitting' }).getAttribute('href')).toBe('/en/admin/services/s2');
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await ServicesAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni hizmet' }).getAttribute('href')).toBe('/tr/yonetim/hizmetler/yeni');
      expect(screen.getByText('Montaj')).toBeTruthy();
    });

    it('says so when there are no services', async () => {
      mocks.listServices.mockResolvedValue([]);
      inIntl('en', await ServicesAdminPage(listProps('en')));
      expect(screen.getByText('There are no services yet. Add the first one.')).toBeTruthy();
    });

    it('turns reordering and deleting off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await ServicesAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Fitting' }) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getAllByText(/In the demo/).length).toBeGreaterThan(0);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(ServicesAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listServices).not.toHaveBeenCalled();
      await expect(ServicesAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await ServicesAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form and tells that uploads are off while there is no file store', async () => {
      inIntl('en', await NewServicePage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New service');
      expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe('');
      expect(screen.getByText(/File upload is off on this site/)).toBeTruthy();
    });

    it('turns the form off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewServicePage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewServicePage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewServicePage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored service', async () => {
      inIntl('en', await EditServicePage(editProps('en', 's1')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit service');
      expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe(
        'Aydınlatma',
      );
      expect((screen.getByLabelText('English', { selector: '#note-en' }) as HTMLInputElement).value).toBe('Note text');
    });

    it('answers an id that does not exist with not found', async () => {
      await expect(EditServicePage(editProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditServicePage(editProps('en', 's1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditServicePage(editProps('xx', 's1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditServicePage(editProps('en', 's1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
