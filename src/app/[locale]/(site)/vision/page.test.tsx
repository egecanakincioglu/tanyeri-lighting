import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../test/axe.ts';
import VisionPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({
  about: { body: { tr: '', en: '' }, vision: { tr: '', en: '' } },
  metadata: null as null | { description: { tr: string; en: string } },
}));

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  notFound: () => {
    throw new Error('not found');
  },
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => ({ home: 'Home', vision: 'Our vision' })[key],
}));
vi.mock('../../../../server/content/about-page.ts', () => ({ getAboutPage: async () => content.about }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: async () => content.metadata }));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as Parameters<typeof VisionPage>[0];

describe('VisionPage', () => {
  beforeEach(() => {
    content.about = {
      body: { tr: '', en: '' },
      vision: { tr: 'Doğru **ışık**', en: 'The right **light**' },
    };
  });
  afterEach(cleanup);

  it('renders the one h1 and the vision text of the language', async () => {
    const { container } = render(await VisionPage(props('en')));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Our vision');
    expect(screen.getByText('light').tagName).toBe('STRONG');
    expect(await axeViolations(container)).toEqual([]);
  });

  it('renders cleanly with empty content', async () => {
    content.about = { body: { tr: '', en: '' }, vision: { tr: '', en: '' } };
    const { container } = render(await VisionPage(props('en')));
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(container.querySelector('article')).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('gives the page name and the saved description as metadata', async () => {
    content.metadata = { description: { tr: 'Açıklama', en: 'Description' } };
    await expect(generateMetadata(props('en'))).resolves.toMatchObject({
      title: 'Our vision',
      description: 'Description',
    });
    content.metadata = null;
    const metadata = await generateMetadata(props('en'));
    expect(metadata.title).toBe('Our vision');
    expect(metadata).not.toHaveProperty('description');
    expect(metadata.alternates?.canonical).toBe('/en/vision');
  });

  it('describes the trail to the page as structured data', async () => {
    const { container } = render(await VisionPage(props('en')));
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(JSON.parse(script?.textContent ?? '')).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Home', item: expect.stringMatching(/\/en$/) },
        { position: 2, name: 'Our vision', item: expect.stringMatching(/\/en\/vision$/) },
      ],
    });
  });

  it('answers an unknown language with not found and no metadata', async () => {
    await expect(VisionPage(props('de'))).rejects.toThrow('not found');
    await expect(generateMetadata(props('de'))).resolves.toEqual({});
  });
});
