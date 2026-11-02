import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../messages/tr.json' with { type: 'json' };
import type { Project } from '../../../../server/content/schemas.ts';
import { axeViolations } from '../../../../test/axe.ts';
import ProjectsPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ projects: vi.fn(), metadata: vi.fn() }));

vi.mock('../../../../server/content/projects.ts', () => ({ listProjects: content.projects }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));

// The real helper needs the Next.js server runtime; this fake reads the same message files.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Header' | 'Projects' }) => {
    const messages = { tr, en }[locale][namespace] as Record<string, string>;
    return Promise.resolve(
      Object.assign((key: string) => messages[key] ?? '', { raw: (key: string) => messages[key] }),
    );
  },
}));

const projects: Project[] = [1, 2].map((n) => ({
  id: `project-${n}`,
  title: { tr: `Proje ${n}`, en: `Project ${n}` },
  description: { tr: `Metin ${n}`, en: `Text ${n}` },
  beforeImageUrl: '/demo/project-konut-before.webp',
  afterImageUrl: '/demo/project-konut-after.webp',
}));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/projects'>;

describe('ProjectsPage', () => {
  beforeEach(() => content.projects.mockResolvedValue(projects));
  afterEach(cleanup);

  it('shows each project with its text and a before and after comparison', async () => {
    const { container } = render(await ProjectsPage(props('en')));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Projects');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Project 1', 'Project 2']);
    expect(screen.getByText('Text 2')).toBeTruthy();
    expect(screen.getAllByRole('slider')).toHaveLength(2);
    expect(screen.getAllByRole('slider')[0]?.getAttribute('aria-valuetext')).toBe('50% before, 50% after');
    expect(container.querySelectorAll('img')).toHaveLength(4);
    expect(container.querySelector('main')).toBeNull();
  });

  it('puts the text before the comparison on small screens and the comparison first from 900 px', async () => {
    const { container } = render(await ProjectsPage(props('en')));
    const article = container.querySelector('article');
    const [title, text, comparison] = [...(article?.children ?? [])] as HTMLElement[];
    expect(title?.tagName).toBe('H2');
    expect(text?.className).toContain('order-2');
    expect(text?.className).toContain('wide:order-3');
    expect(comparison?.className).toContain('order-3');
    expect(comparison?.className).toContain('wide:order-2');
  });

  it('writes the texts in Turkish', async () => {
    render(await ProjectsPage(props('tr')));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Projeler');
    expect(screen.getByText('Metin 1')).toBeTruthy();
    expect(screen.getAllByRole('slider')[0]?.getAttribute('aria-valuetext')).toBe('%50 öncesi, %50 sonrası');
  });

  it('renders only the title without projects', async () => {
    content.projects.mockResolvedValue([]);
    const { container } = render(await ProjectsPage(props('en')));
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('p')).toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = render(<main>{await ProjectsPage(props('tr'))}</main>);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('takes the title from the menu label and the description from the page metadata', async () => {
    content.metadata.mockResolvedValue({
      title: { tr: 'Kayıtlı', en: 'Saved title' },
      description: { tr: 'Açıklama', en: 'About projects' },
    });
    expect(await generateMetadata(props('en'))).toMatchObject({ title: 'Saved title', description: 'About projects' });
    content.metadata.mockResolvedValue(null);
    expect((await generateMetadata(props('en'))).title).toBe('Projects');
    expect(await generateMetadata(props('tr'))).not.toHaveProperty('description');
    expect(await generateMetadata(props('xx'))).toEqual({});
  });
});
