import { describe, expect, it } from 'vitest';
import {
  applicationAreaSchema,
  catalogSchema,
  homeBannerSchema,
  promoBoardSchema,
  referenceSchema,
  serviceSchema,
} from './schemas.ts';

const pair = (tr: string, en: string) => ({ tr, en });
const IMAGE = 'https://store.public.blob.vercel-storage.com/picture.webp';

const schemas = [
  [
    'referenceSchema',
    referenceSchema,
    { imageUrl: IMAGE, name: 'Example', title: pair('Otel', 'Hotel'), description: pair('Lobi', 'Lobby') },
  ],
  [
    'catalogSchema',
    catalogSchema,
    { name: pair('Genel', 'General'), pdfUrl: IMAGE, coverImageUrl: IMAGE, sizeBytes: 1000 },
  ],
  [
    'homeBannerSchema',
    homeBannerSchema,
    {
      imageUrl: IMAGE,
      title: pair('Başlık', 'Title'),
      description: pair('Metin', 'Text'),
      primaryAction: { label: pair('Ürünler', 'Products'), target: 'products' },
      secondaryAction: { label: pair('İletişim', 'Contact'), target: 'contact' },
    },
  ],
  [
    'promoBoardSchema',
    promoBoardSchema,
    { imageUrl: IMAGE, title: pair('Yeni', 'New'), subtitle: pair('', ''), catalogId: 'catalog-1' },
  ],
  [
    'applicationAreaSchema',
    applicationAreaSchema,
    { imageUrl: IMAGE, title: pair('Oteller', 'Hotels'), description: pair('Lobiler', 'Lobbies') },
  ],
  [
    'serviceSchema',
    serviceSchema,
    {
      imageUrl: IMAGE,
      title: pair('Tasarım', 'Design'),
      description: pair('Plan', 'Plan'),
      note: pair('', ''),
    },
  ],
] as const;

describe.each(schemas)('%s image description', (_name, schema, base) => {
  const parse = (imageAlt: unknown) => schema.safeParse({ ...base, imageAlt });

  it('takes a description in both languages and trims it', () => {
    expect(parse(pair(' Bir oda ', ' A room ')).data).toMatchObject({ imageAlt: pair('Bir oda', 'A room') });
  });

  it('takes an empty pair for a decorative picture', () => {
    expect(parse(pair('', '')).data).toMatchObject({ imageAlt: pair('', '') });
  });

  it('refuses a description in one language only', () => {
    expect(parse(pair('Bir oda', '')).success).toBe(false);
    expect(parse(pair('', 'A room')).success).toBe(false);
  });

  it('limits each language to 200 characters', () => {
    expect(parse(pair('a'.repeat(200), 'b'.repeat(200))).success).toBe(true);
    expect(parse(pair('a'.repeat(201), 'b')).success).toBe(false);
    expect(parse(pair('a', 'b'.repeat(201))).success).toBe(false);
  });

  it('requires the pair to be sent, so a form cannot drop it by accident', () => {
    expect(parse(undefined).success).toBe(false);
  });
});
