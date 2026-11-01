import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../test/axe.ts';
import AboutPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({
  about: { body: { tr: '', en: '' }, vision: { tr: '', en: '' } },
  metadata: null as null | { description: { tr: string; en: string } },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => ({ about: 'About us' })[key],
}));
vi.mock('../../../../server/content/about-page.ts', () => ({ getAboutPage: async () => content.about }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: async () => content.metadata }));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as Parameters<typeof AboutPage>[0];

describe('AboutPage', () => {
  beforeEach(() => {
    content.about = {
      body: { tr: 'Merhaba **dünya**\n\n- bir', en: 'Hello **world**\n\n- one\n\n## Approach' },
      vision: { tr: '', en: '' },
    };
    content.metadata = { description: { tr: 'Açıklama', en: 'Description' } };
  });
  afterEach(cleanup);

  it('renders the one h1 and the Markdown text of the language', async () => {
    const { container } = render(await AboutPage(props('en')));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('About us');
    expect(screen.getByText('world').tagName).toBe('STRONG');
    expect(screen.getByRole('heading', { level: 2, name: 'Approach' })).toBeTruthy();
    expect(screen.getByRole('listitem').textContent).toBe('one');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('renders cleanly with empty content', async () => {
    content.about = { body: { tr: '', en: '' }, vision: { tr: '', en: '' } };
    const { container } = render(await AboutPage(props('en')));
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(container.querySelector('article')).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('gives the page name and the saved description as metadata', async () => {
    await expect(generateMetadata(props('en'))).resolves.toEqual({ title: 'About us', description: 'Description' });
    content.metadata = null;
    await expect(generateMetadata(props('en'))).resolves.toEqual({ title: 'About us' });
  });

  it('answers an unknown language with not found and no metadata', async () => {
    await expect(AboutPage(props('de'))).rejects.toThrow('not found');
    await expect(generateMetadata(props('de'))).resolves.toEqual({});
  });
});
