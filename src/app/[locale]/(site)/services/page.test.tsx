import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../../../test/axe.ts';
import ServicesPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({
  services: [] as unknown[],
  metadata: null as null | { description: { tr: string; en: string } },
}));

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('not found');
  },
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => ({ services: 'Services' })[key],
}));
vi.mock('../../../../server/content/services.ts', () => ({ listServices: async () => content.services }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: async () => content.metadata }));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as Parameters<typeof ServicesPage>[0];

describe('ServicesPage', () => {
  beforeEach(() => {
    content.services = [
      {
        id: 'a',
        imageUrl: '/demo/service-tasarim.webp',
        title: { tr: 'Tasarım', en: 'Design' },
        description: { tr: 'Plan **çizeriz**', en: 'We draw the **plan**\n\n- Layout' },
        note: { tr: 'Not', en: 'First visit is free' },
      },
      {
        id: 'b',
        imageUrl: '/demo/service-uygulama.webp',
        title: { tr: 'Uygulama', en: 'Installation' },
        description: { tr: 'Kurarız', en: 'We install' },
        note: { tr: '', en: '' },
      },
    ];
    content.metadata = { description: { tr: 'Açıklama', en: 'Description' } };
  });
  afterEach(cleanup);

  it('renders the one h1 and a card per service with its text inline', async () => {
    const { container } = render(await ServicesPage(props('en')));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Services');
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByRole('heading', { level: 2 }).textContent).toBe('Design');
    expect(within(cards[0]!).getByText('plan').tagName).toBe('STRONG');
    expect(within(cards[0]!).getByText('First visit is free')).toBeTruthy();
    expect(within(cards[1]!).getByRole('heading', { level: 2 }).textContent).toBe('Installation');
    expect(container.querySelectorAll('p.text-muted')).toHaveLength(1);
    expect(screen.queryByRole('button')).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('renders cleanly with empty content', async () => {
    content.services = [];
    const { container } = render(await ServicesPage(props('tr')));
    expect(screen.getAllByRole('heading')).toHaveLength(1);
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('gives the page name and the saved description as metadata', async () => {
    await expect(generateMetadata(props('en'))).resolves.toEqual({ title: 'Services', description: 'Description' });
    content.metadata = null;
    await expect(generateMetadata(props('en'))).resolves.toEqual({ title: 'Services' });
  });

  it('answers an unknown language with not found and no metadata', async () => {
    await expect(ServicesPage(props('de'))).rejects.toThrow('not found');
    await expect(generateMetadata(props('de'))).resolves.toEqual({});
  });
});
