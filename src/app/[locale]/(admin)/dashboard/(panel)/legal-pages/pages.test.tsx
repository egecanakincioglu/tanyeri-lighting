import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditLegalPage from './[key]/page.tsx';
import LegalPagesAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), getLegalPage: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/legal-pages.ts', () => ({ getLegalPage: mocks.getLegalPage }));
vi.mock('../../../../../../server/admin/legal-pages-actions.ts', () => ({ saveLegalPageAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const privacy = {
  title: { tr: 'Gizlilik Politikası', en: 'Privacy Policy' },
  body: { tr: '## Veriler', en: '## Data' },
  updatedAt: new Date(0),
};

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/legal-pages'>;
const editProps = (locale: string, key: string) =>
  ({ params: Promise.resolve({ locale, key }) }) as PageProps<'/[locale]/dashboard/legal-pages/[key]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('legal page screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getLegalPage.mockClear();
    mocks.getLegalPage.mockImplementation(async (key: string) => (key === 'privacy' ? privacy : null));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the saved page as shown on the site and the unsaved one as hidden', async () => {
      inIntl('en', await LegalPagesAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Legal Pages');
      expect(screen.getByText('Privacy Policy')).toBeTruthy();
      expect(screen.getByText('Shown on the site')).toBeTruthy();
      expect(screen.getByText('Hidden')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Edit: Terms' }).getAttribute('href')).toBe(
        '/en/admin/legal-pages/terms',
      );
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await LegalPagesAdminPage(listProps('tr')));
      expect(screen.getByText('Gizlilik Politikası')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Düzenle: Kullanım koşulları' }).getAttribute('href')).toBe(
        '/tr/yonetim/yasal-sayfalar/terms',
      );
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(LegalPagesAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(LegalPagesAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await LegalPagesAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('edit', () => {
    it('fills the form with the saved page and says that empty text hides it', async () => {
      inIntl('en', await EditLegalPage(editProps('en', 'privacy')));
      expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe(
        'Gizlilik Politikası',
      );
      expect((screen.getByLabelText('English', { selector: '#body-en' }) as HTMLTextAreaElement).value).toBe('## Data');
      expect(screen.getByText(/to hide this page/)).toBeTruthy();
    });

    it('shows an empty form for a page that is hidden', async () => {
      inIntl('en', await EditLegalPage(editProps('en', 'terms')));
      expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe('');
    });

    it('turns save off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await EditLegalPage(editProps('en', 'privacy')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('answers a key that is not a legal page with not found', async () => {
      await expect(EditLegalPage(editProps('en', 'home'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditLegalPage(editProps('en', 'privacy'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditLegalPage(editProps('xx', 'privacy'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditLegalPage(editProps('en', 'privacy')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
