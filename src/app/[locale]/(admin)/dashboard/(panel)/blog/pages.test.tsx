import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditBlogPage from './[id]/page.tsx';
import NewBlogPage from './new/page.tsx';
import BlogAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listPosts: vi.fn(), getPost: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/blog.ts', () => ({ listPosts: mocks.listPosts, getPost: mocks.getPost }));
vi.mock('../../../../../../server/admin/blog-actions.ts', () => ({
  createPostAction: vi.fn(),
  updatePostAction: vi.fn(),
  deletePostAction: vi.fn(),
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

const pair = (tr: string, en: string) => ({ tr, en });
const post = {
  id: 'p1',
  slug: 'linear-lighting',
  imageUrl: '/demo/product-kare-sarkit.webp',
  imageAlt: pair('Görsel', 'Picture'),
  title: pair('Lineer aydınlatma', 'Linear lighting'),
  description: pair('Açıklama', 'Description'),
  excerpt: pair('Özet', 'Excerpt'),
  body: pair('Metin', 'Text body'),
  publishedAt: new Date('2026-03-01T00:00:00.000Z'),
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  updatedAt: new Date('2026-03-01T00:00:00.000Z'),
};

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/blog'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/blog/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/blog/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('blog screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listPosts.mockClear();
    mocks.listPosts.mockResolvedValue([
      { ...post, id: 'p0', title: pair('Taslak yazı', 'Draft post'), publishedAt: null },
      post,
      { ...post, id: 'p2', title: pair('Yakında', 'Soon'), publishedAt: new Date('2099-01-01T00:00:00.000Z') },
    ]);
    mocks.getPost.mockClear();
    mocks.getPost.mockImplementation((id: string) => Promise.resolve(id === 'p1' ? post : null));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the articles with their state and a link to create one', async () => {
      inIntl('en', await BlogAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Blog');
      expect(screen.getByRole('link', { name: 'New article' }).getAttribute('href')).toBe('/en/admin/blog/new');
      expect(screen.getByText('Draft')).toBeTruthy();
      expect(screen.getByText('Published on March 1, 2026')).toBeTruthy();
      expect(screen.getByText('Scheduled for January 1, 2099')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Edit: Linear lighting' }).getAttribute('href')).toBe(
        '/en/admin/blog/p1',
      );
      expect(screen.queryByRole('button', { name: /Move up/ })).toBeNull();
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await BlogAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni yazı' }).getAttribute('href')).toBe('/tr/yonetim/blog/yeni');
      expect(screen.getByText('Taslak')).toBeTruthy();
      expect(screen.getByText('Lineer aydınlatma')).toBeTruthy();
    });

    it('says so when there are no articles', async () => {
      mocks.listPosts.mockResolvedValue([]);
      inIntl('en', await BlogAdminPage(listProps('en')));
      expect(screen.getByText('There are no articles yet. Add the first one.')).toBeTruthy();
    });

    it('turns deleting off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await BlogAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Linear lighting' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(BlogAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listPosts).not.toHaveBeenCalled();
      await expect(BlogAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await BlogAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form', async () => {
      inIntl('en', await NewBlogPage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New article');
      expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe('');
    });

    it('turns the form off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewBlogPage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewBlogPage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewBlogPage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored article and its day', async () => {
      const { container } = inIntl('en', await EditBlogPage(editProps('en', 'p1')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit article');
      expect((screen.getByLabelText('Turkish', { selector: '#title-tr' }) as HTMLInputElement).value).toBe(
        'Lineer aydınlatma',
      );
      expect(container.querySelector<HTMLInputElement>('input[name="publishedAt"]')!.value).toBe('2026-03-01');
    });

    it('shows a draft with an empty date', async () => {
      mocks.getPost.mockResolvedValue({ ...post, publishedAt: null });
      const { container } = inIntl('en', await EditBlogPage(editProps('en', 'p1')));
      expect(container.querySelector<HTMLInputElement>('input[name="publishedAt"]')!.value).toBe('');
    });

    it('answers an id that does not exist with not found', async () => {
      await expect(EditBlogPage(editProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditBlogPage(editProps('en', 'p1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditBlogPage(editProps('xx', 'p1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditBlogPage(editProps('en', 'p1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
