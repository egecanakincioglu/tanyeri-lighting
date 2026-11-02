import { describe, expect, it } from 'vitest';
import { readVisitorPlace } from './geo.ts';

describe('readVisitorPlace', () => {
  it('reads the country code and the URL-decoded city', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'tr', 'x-vercel-ip-city': 'Istanbul%20Kadikoy' });
    expect(readVisitorPlace(headers)).toEqual({ country: 'TR', city: 'Istanbul Kadikoy' });
  });

  it('decodes non-ASCII city names', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'TR', 'x-vercel-ip-city': 'Ankara%20%C3%87ankaya' });
    expect(readVisitorPlace(headers).city).toBe('Ankara Çankaya');
  });

  it('stores null when the headers are missing', () => {
    expect(readVisitorPlace(new Headers())).toEqual({ country: null, city: null });
  });

  it('stores null for a country that is not a two-letter code', () => {
    for (const value of ['', 'T', 'TUR', '12', '<b>']) {
      expect(readVisitorPlace(new Headers({ 'x-vercel-ip-country': value })).country).toBeNull();
    }
  });

  it('stores null for a city that cannot be decoded, is empty or is too long', () => {
    expect(readVisitorPlace(new Headers({ 'x-vercel-ip-city': '%E0%A4%A' })).city).toBeNull();
    expect(readVisitorPlace(new Headers({ 'x-vercel-ip-city': '%20' })).city).toBeNull();
    expect(readVisitorPlace(new Headers({ 'x-vercel-ip-city': 'a'.repeat(101) })).city).toBeNull();
  });
});
