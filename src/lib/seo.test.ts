import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { absoluteUrl, localizedPath, pageAlternates } from './seo.ts';

describe('seo helpers', () => {
  beforeEach(() => {
    vi.stubEnv('SITE_URL', 'https://example.test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds addresses in the language of each page', () => {
    expect(localizedPath('tr', '/')).toBe('/tr');
    expect(localizedPath('en', '/about')).toBe('/en/about');
    expect(localizedPath('tr', '/about')).toBe('/tr/hakkimizda');
    expect(localizedPath('tr', { pathname: '/products/[slug]', params: { slug: 'spot' } })).toBe('/tr/urunler/spot');
  });

  it('makes a path absolute on the site address', () => {
    expect(absoluteUrl('/tr/iletisim')).toBe('https://example.test/tr/iletisim');
  });

  it.each(['tr', 'en'] as const)('points the canonical of an inner page at its own address in %s', (locale) => {
    const alternates = pageAlternates(locale, '/contact');
    expect(alternates.canonical).toBe(locale === 'tr' ? '/tr/iletisim' : '/en/contact');
    expect(alternates.languages).toEqual({
      tr: '/tr/iletisim',
      en: '/en/contact',
      'x-default': '/tr/iletisim',
    });
  });

  it('points x-default of the home page at the root, which redirects by language', () => {
    expect(pageAlternates('en', '/')).toEqual({
      canonical: '/en',
      languages: { tr: '/tr', en: '/en', 'x-default': '/' },
    });
  });

  it('gives a product page the Turkish address as x-default', () => {
    const alternates = pageAlternates('en', { pathname: '/products/[slug]', params: { slug: 'spot' } });
    expect(alternates).toEqual({
      canonical: '/en/products/spot',
      languages: { tr: '/tr/urunler/spot', en: '/en/products/spot', 'x-default': '/tr/urunler/spot' },
    });
  });
});
