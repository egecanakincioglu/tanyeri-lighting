import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditSeoPage from './[key]/page.tsx';
import SeoAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), getPageMetadata: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: mocks.getPageMetadata }));
vi.mock('../../../../../../server/admin/page-metadata-actions.ts', () => ({ savePageMetadataAction: vi.fn() }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const home = {
  title: { tr: 'Ana Sayfa', en: 'Home page' },
  description: { tr: 'Açıklama', en: 'A short description' },
  updatedAt: new Date(0),
};

const listProps = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/seo'>;
const editProps = (locale: string, key: string) =>
  ({ params: Promise.resolve({ locale, key }) }) as PageProps<'/[locale]/dashboard/seo/[key]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('page info screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.getPageMetadata.mockClear();
    mocks.getPageMetadata.mockImplementation(async (key: string) => (key === 'home' ? home : null));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('lists every page key, the vision page among them, with its saved title or that it is not set', async () => {
      inIntl('en', await SeoAdminPage(listProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Page Info (SEO)');
      expect(screen.getAllByRole('listitem')).toHaveLength(11);
      expect(screen.getByText('Home page')).toBeTruthy();
      expect(screen.getAllByText('Not set yet')).toHaveLength(10);
      expect(screen.getByRole('link', { name: 'Edit: Our vision' }).getAttribute('href')).toBe('/en/admin/seo/vision');
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await SeoAdminPage(listProps('tr')));
      expect(screen.getByText('Ana Sayfa')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Düzenle: Vizyonumuz' }).getAttribute('href')).toBe(
        '/tr/yonetim/sayfa-bilgileri/vision',
      );
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(SeoAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(SeoAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await SeoAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('edit', () => {
    it('fills the form and counts the characters against the recommended lengths', async () => {
      inIntl('en', await EditSeoPage(editProps('en', 'home')));
      expect((screen.getByLabelText('English', { selector: '#title-en' }) as HTMLInputElement).value).toBe('Home page');
      expect(document.getElementById('title-en-count')!.textContent).toBe('9 of 60 characters (recommended length)');
      expect(document.getElementById('description-en-count')!.textContent).toContain('of 155 characters');
      const title = screen.getByLabelText('English', { selector: '#title-en' });
      await act(async () => {
        fireEvent.change(title, { target: { value: 'x'.repeat(61) } });
      });
      expect(document.getElementById('title-en-count')!.textContent).toContain('may be cut off');
    });

    it('shows an empty form for a page without saved info, and turns save off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await EditSeoPage(editProps('en', 'vision')));
      expect((screen.getByLabelText('English', { selector: '#title-en' }) as HTMLInputElement).value).toBe('');
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('answers an unknown page key with not found', async () => {
      await expect(EditSeoPage(editProps('en', 'dashboard'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditSeoPage(editProps('en', 'home'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditSeoPage(editProps('xx', 'home'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditSeoPage(editProps('en', 'home')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
