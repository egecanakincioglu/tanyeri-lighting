import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../messages/tr.json' with { type: 'json' };
import type { Reference } from '../../../../server/content/schemas.ts';
import { axeViolations } from '../../../../test/axe.ts';
import { imageLoading } from '../../../../test/image-loading.ts';
import ReferencesPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ references: vi.fn(), metadata: vi.fn() }));

vi.mock('../../../../server/content/references.ts', () => ({ listReferences: content.references }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));

// The real helper needs the Next.js server runtime; this fake reads the same message files.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale }: { locale: 'tr' | 'en' }) =>
    Promise.resolve((key: keyof typeof tr.Header) => ({ tr, en })[locale].Header[key]),
}));

const references: Reference[] = [1, 2].map((n) => ({
  id: `reference-${n}`,
  imageUrl: '/demo/area-otel.webp',
  imageAlt: n === 1 ? { tr: 'Otel lobisi', en: 'A hotel lobby' } : { tr: '', en: '' },
  name: `Example Company ${n}`,
  title: { tr: `İş ${n}`, en: `Work ${n}` },
  description: { tr: `Açıklama ${n}`, en: `Description ${n}` },
}));

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/references'>;

describe('ReferencesPage', () => {
  beforeEach(() => content.references.mockResolvedValue(references));
  afterEach(cleanup);

  it.each([
    ['en', 'References', 'Work 1', 'Description 2'],
    ['tr', 'Referanslarımız', 'İş 1', 'Açıklama 2'],
  ])('shows image, name, title and description in %s', async (locale, heading, title, description) => {
    const { container } = render(await ReferencesPage(props(locale)));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
    // The name is a proper name: the same in both languages.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Example Company 1',
      'Example Company 2',
    ]);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
    expect(container.querySelectorAll('img')).toHaveLength(2);
    expect(container.querySelector('main')).toBeNull();
  });

  it.each([
    ['en', 'A hotel lobby'],
    ['tr', 'Otel lobisi'],
  ])('uses the stored description as alt text in %s and leaves a photo without one decorative', async (locale, alt) => {
    const { container } = render(await ReferencesPage(props(locale)));
    expect([...container.querySelectorAll('img')].map((img) => img.getAttribute('alt'))).toEqual([alt, '']);
  });

  it('renders only the title without references', async () => {
    content.references.mockResolvedValue([]);
    const { container } = render(await ReferencesPage(props('en')));
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(container.querySelector('ul')).toBeNull();
  });

  it('fetches only the first photo at once and ahead of the rest', async () => {
    const { container } = render(await ReferencesPage(props('en')));
    expect(imageLoading(container)).toEqual(['eager/high', 'lazy/null']);
  });

  it('has no axe violations', async () => {
    const { container } = render(<main>{await ReferencesPage(props('en'))}</main>);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('takes the title from the menu label and the description from the page metadata', async () => {
    content.metadata.mockResolvedValue({
      title: { tr: 'Kayıtlı', en: 'Saved title' },
      description: { tr: 'Açıklama', en: 'About references' },
    });
    expect(await generateMetadata(props('en'))).toMatchObject({
      title: 'Saved title',
      description: 'About references',
    });
    content.metadata.mockResolvedValue(null);
    expect((await generateMetadata(props('en'))).title).toBe('References');
    expect(await generateMetadata(props('tr'))).not.toHaveProperty('description');
    expect(await generateMetadata(props('xx'))).toEqual({});
  });
});
