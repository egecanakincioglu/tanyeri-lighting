// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  LEGAL_PAGE_KEYS,
  legalPageKeySchema,
  legalPageSchema,
  PAGE_KEYS,
  pageKeySchema,
  pageMetadataSchema,
  projectIdSchema,
  projectOrderSchema,
  projectSchema,
  referenceIdSchema,
  referenceOrderSchema,
  referenceSchema,
  siteSettingsSchema,
  socialLinkIdSchema,
  socialLinkOrderSchema,
  socialLinkSchema,
} from './schemas.ts';

const pair = (tr: string, en: string) => ({ tr, en });

const validSettings = {
  siteName: pair('Tanyeri Aydınlatma', 'Tanyeri Lighting'),
  logoUrl: 'https://store.public.blob.vercel-storage.com/logo.webp',
  phone: '+90 212 000 00 00',
  email: 'info@example.com',
  address: pair('Örnek Mah. 1, Ankara', 'Ornek District 1, Ankara'),
  workingHours: pair('Pazartesi-Cumartesi 09:00-18:00', 'Monday-Saturday 09:00-18:00'),
  serviceArea: pair('Türkiye geneli', 'All over Turkey'),
  languages: pair('Türkçe, İngilizce', 'Turkish, English'),
};

describe('siteSettingsSchema', () => {
  it('accepts a full set of settings', () => {
    expect(siteSettingsSchema.parse(validSettings)).toEqual(validSettings);
  });

  it('accepts no logo as null but not as a missing key', () => {
    expect(siteSettingsSchema.safeParse({ ...validSettings, logoUrl: null }).success).toBe(true);
    expect(siteSettingsSchema.safeParse({ ...validSettings, logoUrl: undefined }).success).toBe(false);
  });

  it.each(['siteName', 'address', 'workingHours', 'serviceArea', 'languages'] as const)(
    'rejects %s with a missing language',
    (field) => {
      expect(siteSettingsSchema.safeParse({ ...validSettings, [field]: { tr: 'Merhaba' } }).success).toBe(false);
      expect(siteSettingsSchema.safeParse({ ...validSettings, [field]: { tr: 'Merhaba', en: ' ' } }).success).toBe(
        false,
      );
    },
  );

  it.each([
    ['siteName', 100],
    ['address', 300],
    ['workingHours', 200],
    ['serviceArea', 200],
    ['languages', 100],
  ] as const)('limits %s to %i characters', (field, max) => {
    const at = pair('a'.repeat(max), 'b'.repeat(max));
    const over = pair('a'.repeat(max + 1), 'b');
    expect(siteSettingsSchema.safeParse({ ...validSettings, [field]: at }).success).toBe(true);
    expect(siteSettingsSchema.safeParse({ ...validSettings, [field]: over }).success).toBe(false);
  });

  it('keeps the phone and the email as one value each, not as a pair', () => {
    expect(
      siteSettingsSchema.safeParse({ ...validSettings, phone: pair('+90 212 000 00 00', '+90 212 000 00 00') }).success,
    ).toBe(false);
    expect(
      siteSettingsSchema.safeParse({ ...validSettings, email: pair('a@example.com', 'a@example.com') }).success,
    ).toBe(false);
  });

  it.each(['+90 212 000 00 00', '0212 000 00 00', '(0312) 123-45-67', '+1-202-555-0143', '5550000'])(
    'accepts the phone number %s and trims it',
    (phone) => {
      expect(siteSettingsSchema.parse({ ...validSettings, phone: ` ${phone} ` }).phone).toBe(phone);
    },
  );

  it.each([
    '',
    '   ',
    '123456',
    '1'.repeat(21),
    '555 abc 0000',
    '+90 212 000 00 00 ext 5',
    '90+212 000 00 00',
    '++90 212 000 00 00',
    'tel:+902120000000',
    '555.000.00.00',
    '<b>5550000</b>',
  ])('rejects the phone number %j', (phone) => {
    expect(siteSettingsSchema.safeParse({ ...validSettings, phone }).success).toBe(false);
  });

  it('limits the phone number to 30 characters', () => {
    const phone = `${'1 '.repeat(15)}1`;
    expect(phone).toHaveLength(31);
    expect(siteSettingsSchema.safeParse({ ...validSettings, phone }).success).toBe(false);
  });

  it.each(['info@example.com', 'first.last+tag@sub.example.co.uk'])('accepts the email %s and trims it', (email) => {
    expect(siteSettingsSchema.parse({ ...validSettings, email: ` ${email} ` }).email).toBe(email);
  });

  it.each(['', 'info', 'info@', '@example.com', 'info@example', 'a b@example.com', 'info@example.com, b@example.com'])(
    'rejects the email %j',
    (email) => {
      expect(siteSettingsSchema.safeParse({ ...validSettings, email }).success).toBe(false);
    },
  );

  it('limits the email to 254 characters', () => {
    const local = 'a'.repeat(64);
    const domain = (label: string) => `${label.repeat(60)}.`;
    const long = `${local}@${domain('b')}${domain('c')}${domain('d')}${domain('e')}com`;
    expect(long.length).toBeGreaterThan(254);
    expect(siteSettingsSchema.safeParse({ ...validSettings, email: long }).success).toBe(false);
  });

  it.each(['http://example.com/logo.webp', 'javascript:alert(1)', 'data:text/html,x', 'not a url', '/logo.webp'])(
    'rejects the logo address %s',
    (logoUrl) => {
      expect(siteSettingsSchema.safeParse({ ...validSettings, logoUrl }).success).toBe(false);
    },
  );

  it.each(['/demo/banner.webp', '/demo/a/b-1_2.pdf', ' /demo/banner.webp '])('accepts the demo path %s', (logoUrl) => {
    expect(siteSettingsSchema.safeParse({ ...validSettings, logoUrl }).success).toBe(true);
  });

  it.each([
    '/demo/',
    '/demo',
    '/demos/a.webp',
    '/other/a.webp',
    '/demo/../secret.webp',
    '/demo/a/../b.webp',
    '/demo//a.webp',
    '//demo/a.webp',
    '//evil.example/demo/a.webp',
    '/demo/a b.webp',
    '/demo/a.webp?x=1',
    'demo/a.webp',
  ])('rejects the path %s', (logoUrl) => {
    expect(siteSettingsSchema.safeParse({ ...validSettings, logoUrl }).success).toBe(false);
  });
});

describe('socialLinkSchema', () => {
  const valid = { platform: 'instagram', label: pair('Instagram', 'Instagram'), url: 'https://instagram.com/tanyeri' };

  it('accepts a link and trims the text', () => {
    expect(
      socialLinkSchema.parse({ ...valid, platform: ' instagram ', url: ' https://instagram.com/tanyeri ' }),
    ).toEqual(valid);
  });

  it.each([
    'http://instagram.com/tanyeri',
    'javascript:alert(1)',
    'mailto:a@example.com',
    'ftp://example.com',
    '/demo/a.webp',
    'x',
  ])('rejects the address %s', (url) => {
    expect(socialLinkSchema.safeParse({ ...valid, url }).success).toBe(false);
  });

  it('requires a platform of 1 to 40 characters', () => {
    expect(socialLinkSchema.safeParse({ ...valid, platform: '  ' }).success).toBe(false);
    expect(socialLinkSchema.safeParse({ ...valid, platform: 'p'.repeat(41) }).success).toBe(false);
  });

  it('requires the label in both languages, up to 60 characters', () => {
    expect(socialLinkSchema.safeParse({ ...valid, label: { tr: 'Instagram' } }).success).toBe(false);
    expect(socialLinkSchema.safeParse({ ...valid, label: pair('a'.repeat(61), 'b') }).success).toBe(false);
  });

  it('limits the address length', () => {
    const long = `https://example.com/${'a'.repeat(2048)}`;
    expect(socialLinkSchema.safeParse({ ...valid, url: long }).success).toBe(false);
  });

  it('checks ids and an order list', () => {
    expect(socialLinkIdSchema.safeParse('').success).toBe(false);
    expect(socialLinkOrderSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(socialLinkOrderSchema.safeParse(['a', 1]).success).toBe(false);
    expect(socialLinkOrderSchema.safeParse('a').success).toBe(false);
  });
});

describe('page keys', () => {
  it('lists the public pages', () => {
    expect([...PAGE_KEYS]).toEqual([
      'home',
      'products',
      'catalogs',
      'services',
      'projects',
      'references',
      'about',
      'contact',
      'privacy',
      'terms',
    ]);
  });

  it('accepts only a listed key', () => {
    expect(pageKeySchema.safeParse('about').success).toBe(true);
    expect(pageKeySchema.safeParse('dashboard').success).toBe(false);
    expect(pageKeySchema.safeParse('').success).toBe(false);
  });

  it('keeps the legal keys among the page keys and nothing else', () => {
    expect([...LEGAL_PAGE_KEYS]).toEqual(['privacy', 'terms']);
    for (const key of LEGAL_PAGE_KEYS) expect(PAGE_KEYS).toContain(key);
    expect(legalPageKeySchema.safeParse('terms').success).toBe(true);
    expect(legalPageKeySchema.safeParse('home').success).toBe(false);
  });
});

describe('pageMetadataSchema', () => {
  const valid = { title: pair('Ana Sayfa', 'Home'), description: pair('Açıklama', 'Description') };

  it('accepts a title and a description in both languages', () => {
    expect(pageMetadataSchema.parse(valid)).toEqual(valid);
  });

  it('requires both languages for the title and for the description', () => {
    expect(pageMetadataSchema.safeParse({ ...valid, title: { tr: 'Ana Sayfa' } }).success).toBe(false);
    expect(pageMetadataSchema.safeParse({ ...valid, description: pair('Açıklama', '') }).success).toBe(false);
    expect(pageMetadataSchema.safeParse({ title: valid.title }).success).toBe(false);
  });

  it('limits the title to 120 and the description to 320 characters', () => {
    expect(pageMetadataSchema.safeParse({ ...valid, title: pair('a'.repeat(121), 'b') }).success).toBe(false);
    expect(pageMetadataSchema.safeParse({ ...valid, description: pair('a', 'b'.repeat(321)) }).success).toBe(false);
    expect(
      pageMetadataSchema.safeParse({ title: pair('a'.repeat(120), 'b'), description: pair('a'.repeat(320), 'b') })
        .success,
    ).toBe(true);
  });
});

describe('legalPageSchema', () => {
  const valid = { title: pair('Gizlilik', 'Privacy'), body: pair('## Veriler\n\nMetin.', '## Data\n\nText.') };

  it('accepts a title and a body in both languages', () => {
    expect(legalPageSchema.parse(valid)).toEqual(valid);
  });

  it('requires both languages for the title and for the body', () => {
    expect(legalPageSchema.safeParse({ ...valid, body: { en: 'Text.' } }).success).toBe(false);
    expect(legalPageSchema.safeParse({ ...valid, title: pair('', 'Privacy') }).success).toBe(false);
  });

  it('limits the title to 150 and the body to 50000 characters', () => {
    expect(legalPageSchema.safeParse({ ...valid, title: pair('a'.repeat(151), 'b') }).success).toBe(false);
    expect(legalPageSchema.safeParse({ ...valid, body: pair('a'.repeat(50_001), 'b') }).success).toBe(false);
    expect(legalPageSchema.safeParse({ ...valid, body: pair('a'.repeat(50_000), 'b') }).success).toBe(true);
  });
});

describe('projectSchema', () => {
  const valid = {
    title: pair('Örnek Villa', 'Sample Villa'),
    description: pair('## Önce ve sonra\n\nMetin.', '## Before and after\n\nText.'),
    beforeImageUrl: 'https://store.public.blob.vercel-storage.com/before.webp',
    afterImageUrl: 'https://store.public.blob.vercel-storage.com/after.webp',
  };

  it('accepts a project and trims the text', () => {
    expect(projectSchema.parse(valid)).toEqual(valid);
    expect(projectSchema.parse({ ...valid, title: pair(' Örnek Villa ', ' Sample Villa ') }).title).toEqual(
      valid.title,
    );
  });

  it.each(['title', 'description'] as const)('requires %s in both languages', (field) => {
    expect(projectSchema.safeParse({ ...valid, [field]: { tr: 'Merhaba' } }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, [field]: pair('Merhaba', ' ') }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, [field]: undefined }).success).toBe(false);
  });

  it('limits the title to 150 and the description to 5000 characters', () => {
    expect(projectSchema.safeParse({ ...valid, title: pair('a'.repeat(150), 'b') }).success).toBe(true);
    expect(projectSchema.safeParse({ ...valid, title: pair('a'.repeat(151), 'b') }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, description: pair('a'.repeat(5000), 'b') }).success).toBe(true);
    expect(projectSchema.safeParse({ ...valid, description: pair('a', 'b'.repeat(5001)) }).success).toBe(false);
  });

  it.each(['beforeImageUrl', 'afterImageUrl'] as const)('accepts only an https address for %s', (field) => {
    for (const url of [
      'http://example.com/a.webp',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'a.webp',
      '',
    ]) {
      expect(projectSchema.safeParse({ ...valid, [field]: url }).success).toBe(false);
    }
    expect(projectSchema.safeParse({ ...valid, [field]: undefined }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, [field]: `https://example.com/${'a'.repeat(2048)}` }).success).toBe(
      false,
    );
  });

  it('checks ids and an order list', () => {
    expect(projectIdSchema.safeParse('').success).toBe(false);
    expect(projectIdSchema.safeParse('a'.repeat(65)).success).toBe(false);
    expect(projectOrderSchema.parse(['a', 'b'])).toEqual(['a', 'b']);
    expect(projectOrderSchema.safeParse(['a', 1]).success).toBe(false);
    expect(projectOrderSchema.safeParse('a').success).toBe(false);
  });
});

describe('referenceSchema', () => {
  const valid = {
    imageUrl: 'https://store.public.blob.vercel-storage.com/logo.webp',
    name: 'Example Hotel',
    title: pair('Otel aydınlatması', 'Hotel lighting'),
    description: pair('Lobi ve odalar.', 'Lobby and rooms.'),
  };

  it('accepts a reference and trims the text', () => {
    expect(referenceSchema.parse(valid)).toEqual(valid);
    expect(referenceSchema.parse({ ...valid, name: ' Example Hotel ' }).name).toBe('Example Hotel');
  });

  it.each(['title', 'description'] as const)('requires %s in both languages', (field) => {
    expect(referenceSchema.safeParse({ ...valid, [field]: { tr: 'Merhaba' } }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...valid, [field]: pair('', 'Hello') }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...valid, [field]: undefined }).success).toBe(false);
  });

  it('requires a single name of 1 to 100 characters', () => {
    expect(referenceSchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...valid, name: pair('Örnek', 'Example') }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...valid, name: 'n'.repeat(100) }).success).toBe(true);
    expect(referenceSchema.safeParse({ ...valid, name: 'n'.repeat(101) }).success).toBe(false);
  });

  it('limits the title to 100 and the description to 500 characters', () => {
    expect(referenceSchema.safeParse({ ...valid, title: pair('a'.repeat(100), 'b') }).success).toBe(true);
    expect(referenceSchema.safeParse({ ...valid, title: pair('a'.repeat(101), 'b') }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...valid, description: pair('a'.repeat(500), 'b') }).success).toBe(true);
    expect(referenceSchema.safeParse({ ...valid, description: pair('a', 'b'.repeat(501)) }).success).toBe(false);
  });

  it('accepts only an https image address', () => {
    for (const imageUrl of ['http://example.com/a.webp', 'javascript:alert(1)', 'ftp://example.com/a.webp', 'logo']) {
      expect(referenceSchema.safeParse({ ...valid, imageUrl }).success).toBe(false);
    }
    expect(referenceSchema.safeParse({ ...valid, imageUrl: undefined }).success).toBe(false);
  });

  it('checks ids and an order list', () => {
    expect(referenceIdSchema.safeParse('').success).toBe(false);
    expect(referenceOrderSchema.parse(['a'])).toEqual(['a']);
    expect(referenceOrderSchema.safeParse([null]).success).toBe(false);
  });
});
