import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../../messages/en.json' with { type: 'json' };
import tr from '../../../../../messages/tr.json' with { type: 'json' };
import type { Catalog } from '../../../../server/content/schemas.ts';
import { axeViolations } from '../../../../test/axe.ts';
import { imageLoading } from '../../../../test/image-loading.ts';
import CatalogsPage, { generateMetadata } from './page.tsx';

const content = vi.hoisted(() => ({ catalogs: vi.fn(), metadata: vi.fn() }));

vi.mock('../../../../server/content/catalogs.ts', () => ({ listCatalogs: content.catalogs }));
vi.mock('../../../../server/content/page-metadata.ts', () => ({ getPageMetadata: content.metadata }));

// The real helper needs the Next.js server runtime; this fake reads the same message files and fills `{name}` values.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Header' | 'Catalogs' }) => {
    const messages = { tr, en }[locale][namespace] as Record<string, string>;
    return Promise.resolve((key: string, values: Record<string, string> = {}) =>
      Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value), messages[key] ?? ''),
    );
  },
}));

const catalogs: Catalog[] = [
  {
    id: 'catalog-1',
    name: { tr: 'Katalog 2026', en: 'Catalog 2026' },
    pdfUrl: '/demo/catalog-2026.pdf',
    coverImageUrl: '/demo/catalog-2026-cover.webp',
    sizeBytes: 2_400_000,
  },
  { id: 'catalog-2', name: { tr: 'Küçük', en: 'Small' }, pdfUrl: '/demo/small.pdf', coverImageUrl: '', sizeBytes: 623 },
  {
    id: 'catalog-3',
    name: { tr: 'Orta', en: 'Medium' },
    pdfUrl: '/demo/medium.pdf',
    coverImageUrl: '/demo/medium-cover.webp',
    sizeBytes: 576_134,
  },
];

const props = (locale: string) => ({ params: Promise.resolve({ locale }) }) as PageProps<'/[locale]/catalogs'>;

describe('CatalogsPage', () => {
  beforeEach(() => content.catalogs.mockResolvedValue(catalogs));
  afterEach(cleanup);

  it('lists each catalog with its size, a view link and a download link', async () => {
    render(await CatalogsPage(props('en')));
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Catalogs');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Catalog 2026',
      'Small',
      'Medium',
    ]);
    expect(screen.getByText('PDF, 2.4 MB')).toBeTruthy();
    expect(screen.getByText('PDF, 623 byte')).toBeTruthy();
    expect(screen.getByText('PDF, 576.1 kB')).toBeTruthy();

    const view = screen.getByRole('link', { name: 'View Catalog 2026 (PDF, opens in a new tab)' });
    expect(view.getAttribute('href')).toBe('/demo/catalog-2026.pdf');
    expect(view.getAttribute('target')).toBe('_blank');
    expect(view.getAttribute('rel')).toBe('noopener noreferrer');
    const download = screen.getByRole('link', { name: 'Download Catalog 2026 (PDF, 2.4 MB)' });
    expect(download.getAttribute('href')).toBe('/demo/catalog-2026.pdf');
    expect(download.hasAttribute('download')).toBe(true);
  });

  it('shows the cover in an empty-alt image and a plain tint with the name when there is none', async () => {
    const { container } = render(await CatalogsPage(props('en')));
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    const cover = items[0]?.querySelector('img');
    expect(cover?.getAttribute('alt')).toBe('');
    expect(decodeURIComponent(cover?.getAttribute('src') ?? '')).toContain('/demo/catalog-2026-cover.webp');
    expect(cover?.getAttribute('sizes')).toContain('min-width: 900px');
    expect(items[1]?.querySelector('img')).toBeNull();
    const coverLink = items[1]?.querySelector('a[aria-hidden="true"]');
    expect(coverLink?.textContent).toBe('Small');
    expect(coverLink?.getAttribute('tabindex')).toBe('-1');
    expect(items[2]?.querySelector('img')).toBeTruthy();
  });

  it('links the cover, the view button and the download button to the PDF, and only two of them take focus', async () => {
    const { container } = render(await CatalogsPage(props('en')));
    const links = [...container.querySelectorAll('li:first-child a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/demo/catalog-2026.pdf',
      '/demo/catalog-2026.pdf',
      '/demo/catalog-2026.pdf',
    ]);
    expect(links.filter((a) => a.getAttribute('tabindex') !== '-1')).toHaveLength(2);
  });

  it('writes the texts and the size in Turkish', async () => {
    render(await CatalogsPage(props('tr')));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Kataloglar');
    expect(screen.getByRole('link', { name: 'Görüntüle: Katalog 2026 (PDF, yeni sekmede açılır)' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^İndir: Katalog 2026/ })).toBeTruthy();
    expect(screen.getByText(/^PDF, 2,4/)).toBeTruthy();
  });

  it('renders only the title without catalogs', async () => {
    content.catalogs.mockResolvedValue([]);
    const { container } = render(await CatalogsPage(props('en')));
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('main')).toBeNull();
  });

  it('fetches only the first cover at once and ahead of the rest', async () => {
    const { container } = render(await CatalogsPage(props('en')));
    expect(imageLoading(container)).toEqual(['eager/high', 'lazy/null']);
  });

  it('has no axe violations', async () => {
    const { container } = render(<main>{await CatalogsPage(props('en'))}</main>);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('takes the title from the menu label and the description from the page metadata', async () => {
    content.metadata.mockResolvedValue({
      title: { tr: 'Kayıtlı', en: 'Saved title' },
      description: { tr: 'Açıklama', en: 'About catalogs' },
    });
    expect(await generateMetadata(props('en'))).toMatchObject({ title: 'Saved title', description: 'About catalogs' });
    expect(await generateMetadata(props('tr'))).toMatchObject({ title: 'Kayıtlı', description: 'Açıklama' });
    content.metadata.mockResolvedValue(null);
    expect((await generateMetadata(props('en'))).title).toBe('Catalogs');
    expect(await generateMetadata(props('en'))).not.toHaveProperty('description');
    expect(await generateMetadata(props('xx'))).toEqual({});
  });
});
