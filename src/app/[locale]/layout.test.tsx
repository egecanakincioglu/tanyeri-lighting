import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import RootLayout, { generateMetadata } from './layout.tsx';

// The real helper needs the Next.js server runtime; this fake reads the same message files.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Metadata' }) =>
    Promise.resolve((key: 'title') => ({ tr, en })[locale][namespace][key]),
}));

// The font loader runs in the Next.js build; the fake keeps the CSS variable name the layout asks for.
vi.mock('next/font/local', () => ({ default: ({ variable }: { variable: string }) => ({ variable }) }));

// connection() only works inside a request; opting into dynamic rendering is its whole effect.
vi.mock('next/server', () => ({ connection: () => Promise.resolve() }));

// Typed with the generated route contract so the test fails to compile if it changes.
const layoutProps = (locale: string, children: ReactNode = null): LayoutProps<'/[locale]'> => ({
  children,
  params: Promise.resolve({ locale }),
});
const metadataProps = (locale: string): Omit<LayoutProps<'/[locale]'>, 'children'> => ({
  params: Promise.resolve({ locale }),
});

describe('RootLayout', () => {
  it.each(['tr', 'en'])('renders <html lang> for %s', async (locale) => {
    const element = await RootLayout(layoutProps(locale, <p>içerik</p>));
    expect(renderToStaticMarkup(element)).toContain(`<html lang="${locale}"`);
  });

  it('sets the font variable on <html>', async () => {
    const element = await RootLayout(layoutProps('tr'));
    expect(renderToStaticMarkup(element)).toContain('class="--font-figtree"');
  });

  it('responds with 404 for an unknown language', async () => {
    await expect(RootLayout(layoutProps('xx'))).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
  });

  it.each(['tr', 'en'])(
    'returns the site title and the template that adds the brand to page titles for %s',
    async (locale) => {
      await expect(generateMetadata(metadataProps(locale))).resolves.toMatchObject({
        title: { default: 'Tanyeri Lighting', template: '%s | Tanyeri Lighting' },
      });
    },
  );

  it('sets the base address that relative canonical links are resolved against', async () => {
    vi.stubEnv('SITE_URL', 'https://example.test/ignored');
    const metadata = await generateMetadata(metadataProps('en'));
    expect(String(metadata.metadataBase)).toBe('https://example.test/');
    vi.unstubAllEnvs();
  });

  describe('robots', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('keeps the site out of search indexes by default', async () => {
      vi.stubEnv('SITE_INDEXING', undefined);
      await expect(generateMetadata(metadataProps('tr'))).resolves.toMatchObject({
        robots: { index: false, follow: false },
      });
    });

    it('sets no robots rule when indexing is on', async () => {
      vi.stubEnv('SITE_INDEXING', 'on');
      const metadata = await generateMetadata(metadataProps('tr'));
      expect(metadata).not.toHaveProperty('robots');
    });
  });
});
