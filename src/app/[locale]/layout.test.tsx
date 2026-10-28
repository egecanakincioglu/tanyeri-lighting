import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import RootLayout, { generateMetadata } from './layout.tsx';

// The real helper needs the Next.js server runtime; this fake reads the same message files.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: 'tr' | 'en'; namespace: 'Metadata' }) =>
    Promise.resolve((key: 'title') => ({ tr, en })[locale][namespace][key]),
}));

describe('RootLayout', () => {
  it.each(['tr', 'en'])('renders <html lang> for %s', async (locale) => {
    const element = await RootLayout({
      children: <p>içerik</p>,
      params: Promise.resolve({ locale }),
    });
    expect(renderToStaticMarkup(element)).toContain(`<html lang="${locale}">`);
  });

  it('responds with 404 for an unknown language', async () => {
    await expect(RootLayout({ children: null, params: Promise.resolve({ locale: 'xx' }) })).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
  });

  it.each(['tr', 'en'])('returns the localized document title for %s', async (locale) => {
    await expect(generateMetadata({ params: Promise.resolve({ locale }) })).resolves.toMatchObject({
      title: 'Tanyeri',
    });
  });
});
