import { describe, expect, it } from 'vitest';
import { slugify } from './slugify.ts';

describe('slugify', () => {
  it('maps Turkish letters to Latin ones, capitals included', () => {
    expect(slugify('Çağdaş Işık Şık Ürün Öğe')).toBe('cagdas-isik-sik-urun-oge');
    expect(slugify('İstanbul')).toBe('istanbul');
    expect(slugify('ığüşöç')).toBe('igusoc');
  });

  it('joins words with single hyphens and trims the ends', () => {
    expect(slugify('  Sarkıt   Avize -- 3 Kollu!  ')).toBe('sarkit-avize-3-kollu');
  });

  it('drops accents of other languages and keeps digits', () => {
    expect(slugify('Café 40W')).toBe('cafe-40w');
  });

  it('gives an empty string when nothing usable is left', () => {
    expect(slugify('')).toBe('');
    expect(slugify('***')).toBe('');
  });
});
