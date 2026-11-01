import { describe, expect, it } from 'vitest';
import { getPathname } from './navigation.ts';

describe('getPathname', () => {
  it('adds the language prefix and the localized address', () => {
    expect(getPathname({ locale: 'tr', href: '/products' })).toBe('/tr/urunler');
    expect(getPathname({ locale: 'en', href: '/products' })).toBe('/en/products');
  });

  it('fills in route parameters', () => {
    expect(getPathname({ locale: 'tr', href: { pathname: '/products/[slug]', params: { slug: 'spot' } } })).toBe(
      '/tr/urunler/spot',
    );
  });

  it('keeps the home page at the language root', () => {
    expect(getPathname({ locale: 'en', href: '/' })).toBe('/en');
  });
});
