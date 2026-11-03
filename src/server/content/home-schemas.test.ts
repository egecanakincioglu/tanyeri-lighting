// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  aboutPageSchema,
  applicationAreaSchema,
  featuredProductIdsSchema,
  homeBannerSchema,
  PAGE_KEYS,
  promoBoardSchema,
  serviceSchema,
} from './schemas.ts';

const pair = (tr: string, en: string) => ({ tr, en });
const IMAGE = 'https://store.public.blob.vercel-storage.com/picture.webp';
const BAD_URLS = ['http://example.com/a.webp', 'javascript:alert(1)', 'ftp://example.com/a.webp', 'picture', ''];

describe('homeBannerSchema', () => {
  const valid = {
    imageUrl: IMAGE,
    imageAlt: pair('Bir görsel', 'A picture'),
    title: pair('Işığın doğru yeri', 'Light in the right place'),
    description: pair('Evler ve iş yerleri için aydınlatma.', 'Lighting for homes and workplaces.'),
    primaryAction: { label: pair('Ürünler', 'Products'), target: 'products' },
    secondaryAction: { label: pair('İletişim', 'Contact'), target: 'contact' },
  };

  it('accepts a full banner and trims the text', () => {
    expect(homeBannerSchema.parse(valid)).toEqual(valid);
    const padded = { ...valid, title: pair(' Başlık ', ' Title ') };
    expect(homeBannerSchema.parse(padded).title).toEqual(pair('Başlık', 'Title'));
  });

  it.each(PAGE_KEYS)('accepts the page %s as the target of both actions', (target) => {
    const banner = {
      ...valid,
      primaryAction: { ...valid.primaryAction, target },
      secondaryAction: { ...valid.secondaryAction, target },
    };
    expect(homeBannerSchema.safeParse(banner).success).toBe(true);
  });

  it.each(['primaryAction', 'secondaryAction'] as const)('rejects a target of %s outside the page keys', (action) => {
    for (const target of ['admin', 'Products', '', '/products', 'https://example.com', undefined, 3]) {
      const banner = { ...valid, [action]: { ...valid[action], target } };
      expect(homeBannerSchema.safeParse(banner).success).toBe(false);
    }
  });

  it.each(['primaryAction', 'secondaryAction'] as const)('requires the label of %s in both languages', (action) => {
    for (const label of [pair('Ürünler', ''), pair('', 'Products'), { tr: 'Ürünler' }, undefined]) {
      expect(homeBannerSchema.safeParse({ ...valid, [action]: { ...valid[action], label } }).success).toBe(false);
    }
  });

  it('limits the label to 40 characters', () => {
    const action = (label: string) => ({ ...valid.primaryAction, label: pair(label, 'x') });
    expect(homeBannerSchema.safeParse({ ...valid, primaryAction: action('a'.repeat(40)) }).success).toBe(true);
    expect(homeBannerSchema.safeParse({ ...valid, primaryAction: action('a'.repeat(41)) }).success).toBe(false);
  });

  it.each(['title', 'description'] as const)('requires %s in both languages', (field) => {
    for (const value of [pair('Merhaba', ''), pair('', 'Hello'), { tr: 'Merhaba' }, undefined]) {
      expect(homeBannerSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    }
  });

  it('limits the title to 120 and the description to 400 characters', () => {
    expect(homeBannerSchema.safeParse({ ...valid, title: pair('a'.repeat(120), 'b') }).success).toBe(true);
    expect(homeBannerSchema.safeParse({ ...valid, title: pair('a', 'b'.repeat(121)) }).success).toBe(false);
    expect(homeBannerSchema.safeParse({ ...valid, description: pair('a'.repeat(400), 'b') }).success).toBe(true);
    expect(homeBannerSchema.safeParse({ ...valid, description: pair('a', 'b'.repeat(401)) }).success).toBe(false);
  });

  it('accepts only an https image address', () => {
    for (const imageUrl of BAD_URLS) expect(homeBannerSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
    expect(homeBannerSchema.safeParse({ ...valid, imageUrl: undefined }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(homeBannerSchema.safeParse({ ...valid, video: IMAGE }).success).toBe(false);
    const action = { ...valid.primaryAction, url: 'https://example.com' };
    expect(homeBannerSchema.safeParse({ ...valid, primaryAction: action }).success).toBe(false);
  });

  it('requires both actions', () => {
    expect(homeBannerSchema.safeParse({ ...valid, secondaryAction: undefined }).success).toBe(false);
    expect(homeBannerSchema.safeParse({ ...valid, primaryAction: undefined }).success).toBe(false);
  });
});

describe('featuredProductIdsSchema', () => {
  it('accepts a list in its order, also an empty one', () => {
    expect(featuredProductIdsSchema.parse(['b', 'a'])).toEqual(['b', 'a']);
    expect(featuredProductIdsSchema.parse([])).toEqual([]);
  });

  it('holds at most six ids', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(featuredProductIdsSchema.safeParse(ids).success).toBe(true);
    expect(featuredProductIdsSchema.safeParse([...ids, 'g']).success).toBe(false);
  });

  it('rejects a repeated id', () => {
    expect(featuredProductIdsSchema.safeParse(['a', 'b', 'a']).success).toBe(false);
  });

  it('rejects ids of the wrong shape and values that are no list', () => {
    expect(featuredProductIdsSchema.safeParse(['a', '']).success).toBe(false);
    expect(featuredProductIdsSchema.safeParse(['a'.repeat(65)]).success).toBe(false);
    expect(featuredProductIdsSchema.safeParse([1]).success).toBe(false);
    expect(featuredProductIdsSchema.safeParse('a').success).toBe(false);
    expect(featuredProductIdsSchema.safeParse(undefined).success).toBe(false);
  });
});

describe('promoBoardSchema', () => {
  const valid = {
    imageUrl: IMAGE,
    imageAlt: pair('Bir görsel', 'A picture'),
    title: pair('Yeni katalog', 'New catalog'),
    subtitle: pair('Kısa satır', 'Short line'),
    catalogId: 'catalog-1',
  };

  it('takes a subtitle in both languages or in neither, up to 120 characters', () => {
    expect(promoBoardSchema.parse({ ...valid, subtitle: pair('', '') }).subtitle).toEqual(pair('', ''));
    for (const subtitle of [pair('Kısa', ''), pair('', 'Short'), pair('a'.repeat(121), 'b'), undefined]) {
      expect(promoBoardSchema.safeParse({ ...valid, subtitle }).success).toBe(false);
    }
    expect(promoBoardSchema.safeParse({ ...valid, subtitle: pair('a'.repeat(120), 'b') }).success).toBe(true);
  });

  it('accepts a board and trims the title', () => {
    expect(promoBoardSchema.parse(valid)).toEqual(valid);
    expect(promoBoardSchema.parse({ ...valid, title: pair(' Yeni ', ' New ') }).title).toEqual(pair('Yeni', 'New'));
  });

  it('requires the title in both languages, up to 100 characters', () => {
    for (const title of [pair('Yeni', ''), pair('', 'New'), { tr: 'Yeni' }, undefined]) {
      expect(promoBoardSchema.safeParse({ ...valid, title }).success).toBe(false);
    }
    expect(promoBoardSchema.safeParse({ ...valid, title: pair('a'.repeat(100), 'b') }).success).toBe(true);
    expect(promoBoardSchema.safeParse({ ...valid, title: pair('a', 'b'.repeat(101)) }).success).toBe(false);
  });

  it('accepts only an https image address', () => {
    for (const imageUrl of BAD_URLS) expect(promoBoardSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
  });

  it('requires a catalog id of the usual shape', () => {
    for (const catalogId of [undefined, '', 'a'.repeat(65), 7]) {
      expect(promoBoardSchema.safeParse({ ...valid, catalogId }).success).toBe(false);
    }
  });

  it('rejects unknown fields', () => {
    expect(promoBoardSchema.safeParse({ ...valid, link: 'https://example.com' }).success).toBe(false);
  });
});

describe('applicationAreaSchema', () => {
  const valid = {
    imageUrl: IMAGE,
    imageAlt: pair('Bir görsel', 'A picture'),
    title: pair('Oteller', 'Hotels'),
    description: pair('Lobiler ve odalar.', 'Lobbies and rooms.'),
  };

  it('accepts an area and trims the text, with no category when none is given', () => {
    expect(applicationAreaSchema.parse(valid)).toEqual({ ...valid, categoryId: null });
    expect(applicationAreaSchema.parse({ ...valid, description: pair(' a ', ' b ') }).description).toEqual(
      pair('a', 'b'),
    );
  });

  it('takes the id of a category, or none, and nothing else', () => {
    expect(applicationAreaSchema.parse({ ...valid, categoryId: 'category-1' }).categoryId).toBe('category-1');
    expect(applicationAreaSchema.parse({ ...valid, categoryId: null }).categoryId).toBeNull();
    for (const categoryId of ['', 'x'.repeat(65), 7]) {
      expect(applicationAreaSchema.safeParse({ ...valid, categoryId }).success).toBe(false);
    }
  });

  it.each(['title', 'description'] as const)('requires %s in both languages', (field) => {
    for (const value of [pair('Merhaba', ''), pair('', 'Hello'), { tr: 'Merhaba' }, undefined]) {
      expect(applicationAreaSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    }
  });

  it('limits the title to 100 and the description to 300 characters', () => {
    expect(applicationAreaSchema.safeParse({ ...valid, title: pair('a'.repeat(100), 'b') }).success).toBe(true);
    expect(applicationAreaSchema.safeParse({ ...valid, title: pair('a', 'b'.repeat(101)) }).success).toBe(false);
    expect(applicationAreaSchema.safeParse({ ...valid, description: pair('a'.repeat(300), 'b') }).success).toBe(true);
    expect(applicationAreaSchema.safeParse({ ...valid, description: pair('a', 'b'.repeat(301)) }).success).toBe(false);
  });

  it('accepts only an https image address', () => {
    for (const imageUrl of BAD_URLS)
      expect(applicationAreaSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(applicationAreaSchema.safeParse({ ...valid, price: 1 }).success).toBe(false);
  });
});

describe('serviceSchema', () => {
  const valid = {
    imageUrl: IMAGE,
    imageAlt: pair('Bir görsel', 'A picture'),
    title: pair('Proje çizimi', 'Lighting design'),
    description: pair('## Süreç\n\nÖlçü alır, çizeriz.', '## Process\n\nWe measure and draw.'),
    note: pair('Keşif ücretsizdir.', 'The site visit is free.'),
  };

  it('accepts a service with a note and trims the text', () => {
    expect(serviceSchema.parse(valid)).toEqual(valid);
    expect(serviceSchema.parse({ ...valid, note: pair(' a ', ' b ') }).note).toEqual(pair('a', 'b'));
  });

  it('accepts a service without a note when both languages are empty', () => {
    expect(serviceSchema.parse({ ...valid, note: pair('', '') }).note).toEqual(pair('', ''));
    expect(serviceSchema.parse({ ...valid, note: pair('  ', ' ') }).note).toEqual(pair('', ''));
  });

  it('rejects a note in one language only', () => {
    expect(serviceSchema.safeParse({ ...valid, note: pair('Keşif ücretsizdir.', '') }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...valid, note: pair('', 'The site visit is free.') }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...valid, note: { tr: 'Keşif ücretsizdir.' } }).success).toBe(false);
  });

  it('requires the note field itself, empty or filled', () => {
    expect(serviceSchema.safeParse({ ...valid, note: undefined }).success).toBe(false);
  });

  it.each(['title', 'description'] as const)('requires %s in both languages', (field) => {
    for (const value of [pair('Merhaba', ''), pair('', 'Hello'), { tr: 'Merhaba' }, undefined]) {
      expect(serviceSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    }
  });

  it('limits the title to 100, the description to 5000 and the note to 500 characters', () => {
    expect(serviceSchema.safeParse({ ...valid, title: pair('a'.repeat(100), 'b') }).success).toBe(true);
    expect(serviceSchema.safeParse({ ...valid, title: pair('a', 'b'.repeat(101)) }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...valid, description: pair('a'.repeat(5000), 'b') }).success).toBe(true);
    expect(serviceSchema.safeParse({ ...valid, description: pair('a', 'b'.repeat(5001)) }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...valid, note: pair('a'.repeat(500), 'b') }).success).toBe(true);
    expect(serviceSchema.safeParse({ ...valid, note: pair('a', 'b'.repeat(501)) }).success).toBe(false);
  });

  it('accepts only an https image address', () => {
    for (const imageUrl of BAD_URLS) expect(serviceSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    expect(serviceSchema.safeParse({ ...valid, price: 1 }).success).toBe(false);
  });
});

describe('aboutPageSchema', () => {
  const valid = {
    body: pair('## Biz kimiz\n\nMetin.', '## Who we are\n\nText.'),
    vision: pair('## Vizyonumuz\n\nMetin.', '## Our vision\n\nText.'),
  };

  it('accepts both texts and trims them', () => {
    expect(aboutPageSchema.parse(valid)).toEqual(valid);
    expect(aboutPageSchema.parse({ ...valid, body: pair(' a ', ' b ') }).body).toEqual(pair('a', 'b'));
  });

  it.each(['body', 'vision'] as const)('requires %s in both languages', (field) => {
    for (const value of [pair('Merhaba', ''), pair('', 'Hello'), pair(' ', ' '), { tr: 'Merhaba' }, undefined]) {
      expect(aboutPageSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
    }
  });

  it('limits each text to 50000 characters', () => {
    for (const field of ['body', 'vision'] as const) {
      expect(aboutPageSchema.safeParse({ ...valid, [field]: pair('a'.repeat(50_000), 'b') }).success).toBe(true);
      expect(aboutPageSchema.safeParse({ ...valid, [field]: pair('a', 'b'.repeat(50_001)) }).success).toBe(false);
    }
  });

  it('rejects unknown fields', () => {
    expect(aboutPageSchema.safeParse({ ...valid, mission: pair('a', 'b') }).success).toBe(false);
  });
});
