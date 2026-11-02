import { describe, expect, it } from 'vitest';
import { isVisitPath } from './path.ts';

describe('isVisitPath', () => {
  it.each([
    '/tr',
    '/en',
    '/tr/urunler',
    '/en/products',
    '/tr/urunler/halka-sarkit-40w',
    '/en/products/halka-sarkit-40w',
    '/tr/iletisim',
    '/en/contact/',
  ])('accepts the public page %s', (path) => {
    expect(isVisitPath(path)).toBe(true);
  });

  it("refuses the other language's address under a language prefix", () => {
    expect(isVisitPath('/en/urunler')).toBe(false);
    expect(isVisitPath('/tr/products')).toBe(false);
  });

  it.each(['/tr/yonetim', '/en/admin', '/en/admin/messages', '/tr/yonetim/mesajlar', '/en/dashboard'])(
    'drops the admin section %s',
    (path) => {
      expect(isVisitPath(path)).toBe(false);
    },
  );

  it.each([
    '',
    '/',
    '/de',
    '/tr/bilinmeyen',
    'tr/urunler',
    'https://example.com/tr',
    '/tr/urunler?x=1',
    '/tr/urunler/a b',
  ])('refuses %j', (path) => {
    expect(isVisitPath(path)).toBe(false);
  });

  it('refuses a path over the length limit', () => {
    expect(isVisitPath(`/tr/urunler/${'a'.repeat(200)}`)).toBe(false);
  });
});
