import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../../../test/axe.ts';
import EditProjectPage from './[id]/page.tsx';
import NewProjectPage from './new/page.tsx';
import ProjectsAdminPage, { generateMetadata } from './page.tsx';

const mocks = vi.hoisted(() => ({ guardPage: vi.fn(), listProjects: vi.fn(), getProject: vi.fn() }));

vi.mock('../../../../../../server/auth/guard.ts', () => ({ guardPage: mocks.guardPage }));
vi.mock('../../../../../../server/content/projects.ts', () => ({
  listProjects: mocks.listProjects,
  getProject: mocks.getProject,
}));
vi.mock('../../../../../../server/admin/projects-actions.ts', () => ({
  createProjectAction: vi.fn(),
  updateProjectAction: vi.fn(),
  deleteProjectAction: vi.fn(),
  reorderProjectsAction: vi.fn(),
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

const project = {
  id: 'p1',
  title: { tr: 'Villa', en: 'Hillside villa' },
  description: { tr: 'Açıklama', en: 'Description text' },
  beforeImageUrl: '/demo/area-otel.webp',
  afterImageUrl: '/demo/area-otel.webp',
};

const listProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/projects'>;
const newProps = (locale: string) =>
  ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/dashboard/projects/new'>;
const editProps = (locale: string, id: string) =>
  ({ params: Promise.resolve({ locale, id }) }) as PageProps<'/[locale]/dashboard/projects/[id]'>;

const inIntl = (locale: 'tr' | 'en', node: ReactNode) =>
  render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      {node}
    </NextIntlClientProvider>,
  );

describe('project screens', () => {
  beforeEach(() => {
    mocks.guardPage.mockClear();
    mocks.guardPage.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.listProjects.mockClear();
    mocks.listProjects.mockResolvedValue([project, { ...project, id: 'p2', title: { tr: 'Ofis', en: 'Office' } }]);
    mocks.getProject.mockClear();
    mocks.getProject.mockImplementation((id: string) => Promise.resolve(id === 'p1' ? project : null));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  describe('list', () => {
    it('shows the projects in the language of the page with a link to create one', async () => {
      inIntl('en', await ProjectsAdminPage(listProps('en')));
      expect(mocks.guardPage).toHaveBeenCalledWith('en');
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Projects');
      expect(screen.getByRole('link', { name: 'New project' }).getAttribute('href')).toBe('/en/admin/projects/new');
      expect(screen.getByText('Hillside villa')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Edit: Office' }).getAttribute('href')).toBe('/en/admin/projects/p2');
    });

    it('is Turkish at the Turkish address', async () => {
      inIntl('tr', await ProjectsAdminPage(listProps('tr')));
      expect(screen.getByRole('link', { name: 'Yeni proje' }).getAttribute('href')).toBe('/tr/yonetim/projeler/yeni');
      expect(screen.getByText('Ofis')).toBeTruthy();
    });

    it('says so when there are no projects', async () => {
      mocks.listProjects.mockResolvedValue([]);
      inIntl('en', await ProjectsAdminPage(listProps('en')));
      expect(screen.getByText('There are no projects yet. Add the first one.')).toBeTruthy();
    });

    it('turns reordering and deleting off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await ProjectsAdminPage(listProps('en')));
      expect((screen.getByRole('button', { name: 'Delete: Office' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(ProjectsAdminPage(listProps('en'))).rejects.toThrow('redirect:');
      expect(mocks.listProjects).not.toHaveBeenCalled();
      await expect(ProjectsAdminPage(listProps('xx'))).rejects.toThrow('not-found');
    });

    it('is kept out of search results and has no axe violations', async () => {
      expect(await generateMetadata(listProps('en'))).toMatchObject({ robots: { index: false, follow: false } });
      const { container } = inIntl('en', await ProjectsAdminPage(listProps('en')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });

  describe('create', () => {
    it('shows an empty form with the Before and After pictures', async () => {
      inIntl('en', await NewProjectPage(newProps('en')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('New project');
      expect(screen.getByText('Before')).toBeTruthy();
      expect(screen.getByText('After')).toBeTruthy();
    });

    it('labels the pictures in Turkish', async () => {
      inIntl('tr', await NewProjectPage(newProps('tr')));
      expect(screen.getByText('Öncesi')).toBeTruthy();
      expect(screen.getByText('Sonrası')).toBeTruthy();
    });

    it('turns the form off in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      inIntl('en', await NewProjectPage(newProps('en')));
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(NewProjectPage(newProps('en'))).rejects.toThrow('redirect:');
      await expect(NewProjectPage(newProps('xx'))).rejects.toThrow('not-found');
    });
  });

  describe('edit', () => {
    it('fills the form with the stored project', async () => {
      inIntl('en', await EditProjectPage(editProps('en', 'p1')));
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Edit project');
      expect((screen.getByLabelText('English', { selector: '#title-en' }) as HTMLInputElement).value).toBe(
        'Hillside villa',
      );
    });

    it('answers an id that does not exist with not found', async () => {
      await expect(EditProjectPage(editProps('en', 'gone'))).rejects.toThrow('not-found');
    });

    it('refuses a visitor without a session and an unknown language', async () => {
      mocks.guardPage.mockRejectedValue(new Error('redirect:/en/admin/sign-in'));
      await expect(EditProjectPage(editProps('en', 'p1'))).rejects.toThrow('redirect:');
      mocks.guardPage.mockResolvedValue({});
      await expect(EditProjectPage(editProps('xx', 'p1'))).rejects.toThrow('not-found');
    });

    it('has no axe violations', async () => {
      const { container } = inIntl('en', await EditProjectPage(editProps('en', 'p1')));
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
