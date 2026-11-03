// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { catalogSchema, categorySchema, idListSchema, idSchema, MAX_CATEGORIES, productSchema } from './schemas.ts';

const pair = (tr: string, en: string) => ({ tr, en });

describe('ids', () => {
  it('checks the shape of an id and of an id list', () => {
    expect(idSchema.safeParse('').success).toBe(false);
    expect(idSchema.safeParse('a'.repeat(65)).success).toBe(false);
    expect(idSchema.parse('a'.repeat(64))).toHaveLength(64);
    expect(idListSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(idListSchema.safeParse(['a', 1]).success).toBe(false);
    expect(idListSchema.safeParse('a').success).toBe(false);
  });
});

describe('categorySchema', () => {
  const valid = { key: 'indoor', name: pair('İç mekan', 'Indoor') };

  const empty = { tr: '', en: '' };

  it('accepts a category and trims the key, with empty page texts when none are given', () => {
    expect(categorySchema.parse(valid)).toEqual({
      ...valid,
      seoTitle: empty,
      seoDescription: empty,
      h1: empty,
      intro: empty,
    });
    expect(categorySchema.parse({ ...valid, key: ' indoor ' }).key).toBe('indoor');
  });

  it('keeps the page texts of a category, trimmed', () => {
    const texts = {
      seoTitle: pair(' Başlık ', ' Title '),
      seoDescription: pair('Açıklama', 'Description'),
      h1: pair('Ana başlık', 'Heading'),
      intro: pair('Giriş', 'Intro'),
    };
    expect(categorySchema.parse({ ...valid, ...texts }).seoTitle).toEqual(pair('Başlık', 'Title'));
    expect(categorySchema.parse({ ...valid, ...texts }).intro).toEqual(pair('Giriş', 'Intro'));
  });

  it.each([
    ['seoTitle', 70],
    ['seoDescription', 320],
    ['h1', 100],
    ['intro', 600],
  ] as const)('limits %s to %i characters and wants it in both languages or neither', (field, max) => {
    expect(categorySchema.safeParse({ ...valid, [field]: pair('a'.repeat(max), 'b') }).success).toBe(true);
    expect(categorySchema.safeParse({ ...valid, [field]: pair('a', 'b'.repeat(max + 1)) }).success).toBe(false);
    expect(categorySchema.safeParse({ ...valid, [field]: pair('a', '') }).success).toBe(false);
    expect(categorySchema.safeParse({ ...valid, [field]: pair('', 'b') }).success).toBe(false);
    expect(categorySchema.safeParse({ ...valid, [field]: pair('  ', '') }).success).toBe(true);
  });

  it('allows at most 8 categories', () => {
    expect(MAX_CATEGORIES).toBe(8);
  });

  it.each(['wall-lights', 'a', 'led-2-x', '2024'])('accepts the key %s', (key) => {
    expect(categorySchema.safeParse({ ...valid, key }).success).toBe(true);
  });

  it.each([
    '',
    '  ',
    'Indoor',
    'iç-mekan',
    'wall_lights',
    '-indoor',
    'indoor-',
    'in--door',
    'in door',
    'in/door',
    'a'.repeat(61),
  ])('rejects the key %j', (key) => {
    expect(categorySchema.safeParse({ ...valid, key }).success).toBe(false);
  });

  it('limits the key to 60 characters', () => {
    expect(categorySchema.safeParse({ ...valid, key: 'a'.repeat(60) }).success).toBe(true);
  });

  it('requires the name in both languages, up to 60 characters', () => {
    expect(categorySchema.safeParse({ ...valid, name: { tr: 'İç mekan' } }).success).toBe(false);
    expect(categorySchema.safeParse({ ...valid, name: pair('İç mekan', ' ') }).success).toBe(false);
    expect(categorySchema.safeParse({ ...valid, name: pair('a'.repeat(61), 'b') }).success).toBe(false);
    expect(categorySchema.safeParse({ ...valid, name: pair('a'.repeat(60), 'b'.repeat(60)) }).success).toBe(true);
  });
});

describe('productSchema', () => {
  const valid = {
    categoryId: 'category-1',
    slug: 'ring-pendant-120',
    code: 'RP-120',
    name: pair('Halka sarkıt', 'Ring pendant'),
    color: pair('Mat siyah', 'Matte black'),
    material: pair('Alüminyum', 'Aluminium'),
    power: '12 W',
    dimensions: 'Ø 120 × 85 mm',
    imageUrl: 'https://store.public.blob.vercel-storage.com/ring.webp',
  };
  const withNoDetails = {
    ...valid,
    description: pair('', ''),
    luminousFlux: '',
    colorTemperature: '',
    cri: '',
    ip: '',
  };

  it('accepts a product and trims the single values', () => {
    expect(productSchema.parse(valid)).toEqual(withNoDetails);
    expect(
      productSchema.parse({
        ...valid,
        code: ' RP-120 ',
        power: ' 12 W ',
        dimensions: ' Ø 120 × 85 mm ',
        slug: ' ring-pendant-120 ',
      }),
    ).toEqual(withNoDetails);
  });

  it('leaves the description and the technical values empty when they are not given', () => {
    expect(productSchema.parse(valid)).toMatchObject({
      description: pair('', ''),
      luminousFlux: '',
      colorTemperature: '',
      cri: '',
      ip: '',
    });
  });

  it('accepts a description and the technical values, trimmed', () => {
    const details = {
      description: pair(' İki cümle. ', ' Two sentences. '),
      luminousFlux: ' 1050 lm ',
      colorTemperature: '3000 K',
      cri: 'Ra 90',
      ip: 'IP20',
    };
    expect(productSchema.parse({ ...valid, ...details })).toMatchObject({
      ...details,
      description: pair('İki cümle.', 'Two sentences.'),
      luminousFlux: '1050 lm',
    });
  });

  it('fills the description in both languages or in neither', () => {
    expect(productSchema.safeParse({ ...valid, description: pair('Açıklama', '') }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, description: pair('', 'Description') }).success).toBe(false);
  });

  it.each(['luminousFlux', 'colorTemperature', 'cri', 'ip'] as const)('limits %s to 20 characters', (field) => {
    expect(productSchema.safeParse({ ...valid, [field]: 'a'.repeat(20) }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, [field]: 'a'.repeat(21) }).success).toBe(false);
  });

  it('limits the description to 500 characters', () => {
    expect(productSchema.safeParse({ ...valid, description: pair('a'.repeat(500), 'b'.repeat(500)) }).success).toBe(
      true,
    );
    expect(productSchema.safeParse({ ...valid, description: pair('a'.repeat(501), 'b') }).success).toBe(false);
  });

  it.each(['name', 'color', 'material'] as const)('rejects %s with a missing language', (field) => {
    expect(productSchema.safeParse({ ...valid, [field]: { tr: 'Mat siyah' } }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, [field]: pair('Mat siyah', '') }).success).toBe(false);
  });

  it.each([
    ['name', 120],
    ['color', 60],
    ['material', 100],
  ] as const)('limits %s to %i characters', (field, max) => {
    expect(productSchema.safeParse({ ...valid, [field]: pair('a'.repeat(max), 'b'.repeat(max)) }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, [field]: pair('a'.repeat(max + 1), 'b') }).success).toBe(false);
  });

  it.each([
    'Ring-Pendant',
    'ring_pendant',
    'halka-sarkıt',
    '-ring',
    'ring-',
    'ring--pendant',
    'ring pendant',
    '',
    '  ',
  ])('rejects the slug %j', (slug) => {
    expect(productSchema.safeParse({ ...valid, slug }).success).toBe(false);
  });

  it('limits the slug to 80 characters', () => {
    expect(productSchema.safeParse({ ...valid, slug: 'a'.repeat(80) }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, slug: 'a'.repeat(81) }).success).toBe(false);
  });

  it('keeps the code, the power and the dimensions as one value each, not as a pair', () => {
    for (const field of ['code', 'power', 'dimensions']) {
      expect(productSchema.safeParse({ ...valid, [field]: pair('x', 'y') }).success).toBe(false);
      expect(productSchema.safeParse({ ...valid, [field]: ' ' }).success).toBe(false);
    }
  });

  it.each([
    ['code', 60],
    ['power', 40],
    ['dimensions', 60],
  ] as const)('limits %s to %i characters', (field, max) => {
    expect(productSchema.safeParse({ ...valid, [field]: 'a'.repeat(max) }).success).toBe(true);
    expect(productSchema.safeParse({ ...valid, [field]: 'a'.repeat(max + 1) }).success).toBe(false);
  });

  it.each(['http://example.com/ring.webp', 'javascript:alert(1)', 'data:text/html,x', 'not a url', '/ring.webp', ''])(
    'rejects the image address %j',
    (imageUrl) => {
      expect(productSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
    },
  );

  it('requires an image and a category', () => {
    expect(productSchema.safeParse({ ...valid, imageUrl: undefined }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, imageUrl: null }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, categoryId: '' }).success).toBe(false);
  });

  it('does not accept a price, in any form', () => {
    expect(productSchema.safeParse({ ...valid, price: 100 }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, price: pair('100', '100') }).success).toBe(false);
    expect(productSchema.safeParse({ ...valid, sortOrder: 3 }).success).toBe(false);
  });
});

describe('catalogSchema', () => {
  const valid = {
    name: pair('Genel katalog', 'General catalog'),
    pdfUrl: 'https://store.public.blob.vercel-storage.com/catalog.pdf',
    coverImageUrl: 'https://store.public.blob.vercel-storage.com/cover.webp',
    imageAlt: pair('Bir kapak', 'A cover'),
    sizeBytes: 2_500_000,
  };

  it('accepts a catalog', () => {
    expect(catalogSchema.parse(valid)).toEqual(valid);
  });

  it('requires the name in both languages, up to 120 characters', () => {
    expect(catalogSchema.safeParse({ ...valid, name: { tr: 'Genel katalog' } }).success).toBe(false);
    expect(catalogSchema.safeParse({ ...valid, name: pair('a'.repeat(121), 'b') }).success).toBe(false);
  });

  it.each(['http://example.com/c.pdf', 'javascript:alert(1)', 'ftp://example.com/c.pdf', '/c.pdf', ''])(
    'rejects the PDF address %j',
    (pdfUrl) => {
      expect(catalogSchema.safeParse({ ...valid, pdfUrl }).success).toBe(false);
    },
  );

  it.each(['', '/demo/catalog-2026-cover.webp'])('accepts the cover address %j', (coverImageUrl) => {
    expect(catalogSchema.parse({ ...valid, coverImageUrl }).coverImageUrl).toBe(coverImageUrl);
  });

  it.each(['http://example.com/c.webp', 'javascript:alert(1)', '/c.webp', '  ', '/demo/../c.webp', null, undefined])(
    'rejects the cover address %j',
    (coverImageUrl) => {
      expect(catalogSchema.safeParse({ ...valid, coverImageUrl }).success).toBe(false);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, 2_147_483_648, '100', null])('rejects the size %j', (sizeBytes) => {
    expect(catalogSchema.safeParse({ ...valid, sizeBytes }).success).toBe(false);
  });

  it('accepts the smallest and the largest size', () => {
    expect(catalogSchema.safeParse({ ...valid, sizeBytes: 1 }).success).toBe(true);
    expect(catalogSchema.safeParse({ ...valid, sizeBytes: 2_147_483_647 }).success).toBe(true);
  });
});
