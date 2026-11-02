import { afterEach, describe, expect, it } from 'vitest';
import { LOCALE_COOKIE, rememberLocale, switchHref, type SwitchRoute } from './language-switch.ts';

const routes: SwitchRoute[] = [
  { tr: '/tr', en: '/en' },
  { tr: '/tr/urunler', en: '/en/products' },
  { tr: '/tr/urunler/[slug]', en: '/en/products/[slug]' },
  { tr: '/tr/blog/[slug]/[page]', en: '/en/journal/[slug]/[page]' },
];

describe('switchHref', () => {
  it.each([
    ['/tr', 'tr', 'en', '/en'],
    ['/en', 'en', 'tr', '/tr'],
    ['/tr/urunler', 'tr', 'en', '/en/products'],
    ['/en/products', 'en', 'tr', '/tr/urunler'],
    ['/tr/urunler/', 'tr', 'en', '/en/products'],
  ])('swaps the language of %s', (pathname, from, to, expected) => {
    expect(switchHref(pathname, from, to, routes)).toBe(expected);
  });

  it('carries the parameters of a dynamic page into the other address', () => {
    expect(switchHref('/tr/urunler/cerceveli-gomme-spot-7w', 'tr', 'en', routes)).toBe(
      '/en/products/cerceveli-gomme-spot-7w',
    );
    expect(switchHref('/en/products/ray-spot', 'en', 'tr', routes)).toBe('/tr/urunler/ray-spot');
    expect(switchHref('/tr/blog/a/2', 'tr', 'en', routes)).toBe('/en/journal/a/2');
  });

  it('keeps an encoded parameter encoded exactly once', () => {
    expect(switchHref('/tr/urunler/%C3%A7ift-spot', 'tr', 'en', routes)).toBe('/en/products/%C3%A7ift-spot');
    expect(switchHref('/tr/urunler/çift-spot', 'tr', 'en', routes)).toBe('/en/products/%C3%A7ift-spot');
    expect(switchHref('/tr/urunler/100%', 'tr', 'en', routes)).toBe('/en/products/100%');
  });

  it('does not take a deeper address for a page without parameters', () => {
    expect(switchHref('/tr/urunler/a/b', 'tr', 'en', routes)).toBe('/en/urunler/a/b');
  });

  it('keeps the path of an address no page answers', () => {
    expect(switchHref('/tr/yok/bir-sayfa', 'tr', 'en', routes)).toBe('/en/yok/bir-sayfa');
    expect(switchHref('/elsewhere', 'tr', 'en', routes)).toBe('/en');
  });
});

describe('rememberLocale', () => {
  afterEach(() => {
    document.cookie = `${LOCALE_COOKIE}=;path=/;max-age=0`;
  });

  it('stores the chosen language where the proxy reads it', () => {
    rememberLocale('en');
    expect(document.cookie).toContain('NEXT_LOCALE=en');
  });
});
