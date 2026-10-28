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
    expect(renderToStaticMarkup(element)).toContain(`<html lang="${locale}">`);
  });

  it('responds with 404 for an unknown language', async () => {
    await expect(RootLayout(layoutProps('xx'))).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
  });

  it.each(['tr', 'en'])('returns the localized document title for %s', async (locale) => {
    await expect(generateMetadata(metadataProps(locale))).resolves.toMatchObject({
      title: 'Tanyeri',
    });
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
