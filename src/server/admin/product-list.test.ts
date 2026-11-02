import { describe, expect, it } from 'vitest';
import type { Product } from '../content/schemas.ts';
import { PRODUCTS_PER_PAGE, paginate, parseProductQuery, searchProducts } from './product-list.ts';

const keys = ['indoor', 'outdoor'];

describe('parseProductQuery', () => {
  it('reads a clean query', () => {
    expect(parseProductQuery({ q: ' avize ', category: 'indoor', page: '3' }, keys)).toEqual({
      q: 'avize',
      category: 'indoor',
      page: 3,
    });
  });

  it('falls back for missing, unknown and malformed values', () => {
    const fallback = { q: '', category: '', page: 1 };
    expect(parseProductQuery({}, keys)).toEqual(fallback);
    expect(parseProductQuery({ category: 'nope', page: 'abc' }, keys)).toEqual(fallback);
    expect(parseProductQuery({ page: '0' }, keys).page).toBe(1);
    expect(parseProductQuery({ page: '-4' }, keys).page).toBe(1);
    expect(parseProductQuery({ page: '2.5' }, keys).page).toBe(1);
    expect(parseProductQuery({ page: '1e999' }, keys).page).toBe(1);
  });

  it('takes the first of a repeated value and cuts a long search', () => {
    expect(parseProductQuery({ category: ['outdoor', 'indoor'] }, keys).category).toBe('outdoor');
    expect(parseProductQuery({ q: 'a'.repeat(300) }, keys).q).toHaveLength(100);
  });
});

function product(code: string, tr: string, en: string): Product {
  const pair = { tr: 'x', en: 'x' };
  return {
    id: code,
    categoryId: 'c',
    categoryKey: 'indoor',
    slug: code.toLowerCase(),
    code,
    name: { tr, en },
    color: pair,
    material: pair,
    power: '10 W',
    dimensions: '1 cm',
    imageUrl: '/demo/a.webp',
  };
}

describe('searchProducts', () => {
  const list = [product('AV-100', 'Işık avize', 'Chandelier'), product('AP-200', 'Aplik', 'Wall lamp')];

  it('matches the name in either language or the code, ignoring case', () => {
    expect(searchProducts(list, 'chand').map((item) => item.code)).toEqual(['AV-100']);
    expect(searchProducts(list, 'APLİK').map((item) => item.code)).toEqual(['AP-200']);
    expect(searchProducts(list, 'ışık').map((item) => item.code)).toEqual(['AV-100']);
    expect(searchProducts(list, 'ap-2').map((item) => item.code)).toEqual(['AP-200']);
  });

  it('returns everything for an empty search and nothing for no match', () => {
    expect(searchProducts(list, '')).toHaveLength(2);
    expect(searchProducts(list, 'zzz')).toEqual([]);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: PRODUCTS_PER_PAGE * 2 + 1 }, (_, index) => index);

  it('cuts pages of 24', () => {
    expect(paginate(items, 1)).toMatchObject({ page: 1, pages: 3 });
    expect(paginate(items, 1).items).toHaveLength(PRODUCTS_PER_PAGE);
    expect(paginate(items, 3).items).toEqual([48]);
  });

  it('clamps a page past the end and gives one empty page for no items', () => {
    expect(paginate(items, 99)).toMatchObject({ page: 3, pages: 3 });
    expect(paginate([], 5)).toEqual({ items: [], page: 1, pages: 1 });
  });
});
