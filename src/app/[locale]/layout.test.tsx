import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RootLayout from './layout.tsx';

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
});
