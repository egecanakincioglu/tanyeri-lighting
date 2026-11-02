import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditCategoryPage from './[id]/page.tsx';
import NewCategoryPage from './new/page.tsx';
import CategoriesAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listCategories: vi.fn(), update: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/categories.ts', () => ({ listCategories: mocks.listCategories }));
vi.mock('../../../../../../server/admin/categories-actions.ts', () => ({
  createCategoryAction: vi.fn(),
  updateCategoryAction: mocks.update,
  deleteCategoryAction: vi.fn(),
  reorderCategoriesAction: vi.fn(),
}));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('next-intl/server', async () => ({
  getTranslations: (await import('../../../../../../test/translations.ts')).getTranslations,
}));

const category = (index: number) => ({
  id: `c${index}`,
  key: `group-${index}`,
  name: { tr: `Grup ${index}`, en: `Group ${index}` },
  seoTitle: { tr: `Başlık ${index}`, en: `Title ${index}` },
  seoDescription: { tr: `Açıklama ${index}`, en: `Description ${index}` },
  h1: { tr: '', en: '' },
  intro: { tr: `Giriş ${index}`, en: `Intro ${index}` },
});

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/categories'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/categories/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/categories/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('category screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listCategories.mockClear();
    mocks.listCategories.mockResolvedValue([category(1), category(2)]);
    mocks.update.mockClear();
    mocks.update.mockResolvedValue({ status: 'success' });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the categories, how many of the limit are used, and a link to create one', async () => {
      inIntl('en', await CategoriesAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Categories');
      expect(screen.getByText('2 of 8 categories used.')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'New category' }).getAttribute('href')).toBe('/en/admin/categories/new');
      expect(screen.getByText('Group 1')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Edit: Group 2' }).getAttribute('href')).toBe('/en/admin/categories/c2');
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await CategoriesAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni kategori' }).getAttribute('href')).toBe(
        '/tr/yonetim/kategoriler/yeni',
      );
      expect(screen.getByText('Grup 1')).toBeTruthy();
    });

    it('says the limit is reached and offers no create link at eight', async () => {
      mocks.listCategories.mockResolvedValue(Array.from({ length: 8 }, (_, index) => category(index + 1)));
      inIntl('en', await CategoriesAdminPage(listProps('en')));
      expect(screen.getByText(/limit of 8 categories is reached/)).toBeTruthy();
      expect(screen.queryByRole('link', { name: 'New category' })).toBeNull();
    });

    it('says so when there are none', async () => {
      mocks.listCategories.mockResolvedValue([]);
      inIntl('en', await CategoriesAdminPage(listProps('en')));
      expect(screen.getByText('There are no categories yet. Add the first one.')).toBeTruthy();
    });

    it('turns reordering and deleting off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await CategoriesAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Group 1' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(CategoriesAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listCategories).not.toHaveBeenCalled();
      await expect(CategoriesAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await CategoriesAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form with the hint about the short name', async () => {
      inIntl('en', await NewCategoryPage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New category');
      expect((screen.getByLabelText('Short name for addresses') as HTMLInputElement).value).toBe('');
      expect(screen.getByText(/appears in the address/)).toBeTruthy();
    });

    it('has the four optional page texts, empty, with the hint about the fallback', async () => {
      inIntl('en', await NewCategoryPage(newProps('en')));
      for (const name of ['seoTitle', 'seoDescription', 'h1', 'intro']) {
        expect((document.getElementById(`${name}-tr`) as HTMLInputElement).value).toBe('');
        expect((document.getElementById(`${name}-en`) as HTMLInputElement).required).toBe(false);
      }
      expect(screen.getByRole('group', { name: 'Search result title' })).toBeTruthy();
      expect(screen.getByRole('group', { name: 'Short text under the heading' })).toBeTruthy();
      expect(screen.getByText(/An empty field uses the category name/)).toBeTruthy();
    });

    it('turns saving off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewCategoryPage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewCategoryPage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewCategoryPage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored category', async () => {
      inIntl('en', await EditCategoryPage(editProps('en', 'c2')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit category');
      expect((screen.getByLabelText('Short name for addresses') as HTMLInputElement).value).toBe('group-2');
      expect((document.getElementById('name-tr') as HTMLInputElement).value).toBe('Grup 2');
    });

    it('fills the page texts and sends them on save', async () => {
      inIntl('en', await EditCategoryPage(editProps('en', 'c2')));
      expect((document.getElementById('seoTitle-en') as HTMLInputElement).value).toBe('Title 2');
      expect((document.getElementById('seoDescription-tr') as HTMLTextAreaElement).value).toBe('Açıklama 2');
      expect((document.getElementById('intro-en') as HTMLTextAreaElement).value).toBe('Intro 2');
      expect((document.getElementById('h1-en') as HTMLInputElement).value).toBe('');
      fireEvent.change(document.getElementById('h1-en')!, { target: { value: 'New heading' } });
      fireEvent.change(document.getElementById('h1-tr')!, { target: { value: 'Yeni başlık' } });
      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
      });
      expect(Object.fromEntries(mocks.update.mock.calls[0]![1].entries())).toMatchObject({
        id: 'c2',
        'seoTitle.en': 'Title 2',
        'seoDescription.tr': 'Açıklama 2',
        'h1.en': 'New heading',
        'h1.tr': 'Yeni başlık',
        'intro.en': 'Intro 2',
      });
    });

    it('says which page text is incomplete and keeps what was typed', async () => {
      mocks.update.mockResolvedValue({
        status: 'error',
        code: 'invalid',
        fieldErrors: { h1: { code: 'invalid' }, 'seoTitle.en': { code: 'tooLong', max: 70 } },
      });
      inIntl('en', await EditCategoryPage(editProps('en', 'c1')));
      fireEvent.change(document.getElementById('h1-tr')!, { target: { value: 'Typed' } });
      await act(async () => {
        fireEvent.submit(screen.getByRole('button', { name: 'Save' }).closest('form')!);
      });
      expect(document.getElementById('h1-error')).toBeTruthy();
      expect(document.getElementById('seoTitle-en-error')?.textContent).toBe('At most 70 characters.');
      expect((document.getElementById('h1-tr') as HTMLInputElement).value).toBe('Typed');
    });

    it('turns saving off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await EditCategoryPage(editProps('en', 'c1')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('answers an id that does not exist with not found', async () => {
      await expect(EditCategoryPage(editProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditCategoryPage(editProps('en', 'c1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditCategoryPage(editProps('xx', 'c1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditCategoryPage(editProps('en', 'c1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
