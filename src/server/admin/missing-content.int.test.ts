import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.ts';
import { getMissingContent } from './missing-content.ts';

const db = getDb();

async function clear() {
  await db.featuredProduct.deleteMany();
  await db.promoBoard.deleteMany();
  await db.catalog.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.service.deleteMany();
  await db.applicationArea.deleteMany();
  await db.reference.deleteMany();
  await db.blogPost.deleteMany();
  await db.homeBanner.deleteMany();
}

const alt = { imageAltTr: 'Açıklama', imageAltEn: 'Description' };
const text = { titleTr: 'a', titleEn: 'a', descriptionTr: 'a', descriptionEn: 'a' };

function product(n: number, overrides: Record<string, string> = {}) {
  return {
    slug: `p-${n}`,
    code: `C-${n}`,
    nameTr: 'a',
    nameEn: 'a',
    colorTr: 'a',
    colorEn: 'a',
    materialTr: 'a',
    materialEn: 'a',
    power: '1',
    dimensions: '1',
    imageUrl: '/x.webp',
    sortOrder: n,
    descriptionTr: 'a',
    descriptionEn: 'a',
    luminousFlux: '1',
    colorTemperature: '1',
    cri: '1',
    ip: '1',
    ...overrides,
  };
}

function post(n: number, publishedAt: Date | null) {
  return {
    slug: `post-${n}`,
    titleTr: 'a',
    titleEn: 'a',
    descriptionTr: 'a',
    descriptionEn: 'a',
    excerptTr: 'a',
    excerptEn: 'a',
    bodyTr: 'a',
    bodyEn: 'a',
    imageUrl: '/x.webp',
    imageAltTr: 'a',
    imageAltEn: 'a',
    publishedAt,
  };
}

describe('missing content on a real database', () => {
  beforeEach(clear);
  afterAll(async () => {
    await clear();
    await db.$disconnect();
  });

  it('is all zero on an empty database', async () => {
    expect(await getMissingContent()).toEqual({
      productsWithoutDescription: 0,
      productsWithoutTechnicalValue: 0,
      draftPosts: 0,
      imagesWithoutDescription: {
        services: 0,
        applicationAreas: 0,
        references: 0,
        promoBoards: 0,
        catalogs: 0,
        homeBanner: 0,
      },
    });
  });

  it('counts products with an empty description in either language or an empty technical value', async () => {
    const category = await db.category.create({ data: { key: 'k', nameTr: 'a', nameEn: 'a', sortOrder: 0 } });
    const rows = [
      product(1),
      product(2, { descriptionTr: '' }),
      product(3, { descriptionEn: '' }),
      product(4, { cri: '' }),
      product(5, { ip: '', luminousFlux: '' }),
    ];
    await db.product.createMany({ data: rows.map((row) => ({ ...row, categoryId: category.id })) });
    const missing = await getMissingContent();
    expect(missing.productsWithoutDescription).toBe(2);
    expect(missing.productsWithoutTechnicalValue).toBe(2);
  });

  it('counts draft posts only', async () => {
    await db.blogPost.createMany({ data: [post(1, null), post(2, null), post(3, new Date())] });
    expect((await getMissingContent()).draftPosts).toBe(2);
  });

  it('counts pictures without a description per table, a banner row once, and skips a catalog without a cover', async () => {
    const service = { imageUrl: '/x', ...text, noteTr: '', noteEn: '' };
    await db.service.createMany({
      data: [
        { ...service, ...alt, sortOrder: 0 },
        { ...service, imageAltTr: '', imageAltEn: 'b', sortOrder: 1 },
      ],
    });
    await db.reference.create({ data: { imageUrl: '/x', name: 'n', ...text, sortOrder: 0 } });
    await db.applicationArea.create({ data: { imageUrl: '/x', ...alt, ...text, sortOrder: 0 } });
    const withCover = await db.catalog.create({
      data: { nameTr: 'a', nameEn: 'a', pdfUrl: '/a.pdf', coverImageUrl: '/c.webp', sizeBytes: 1, sortOrder: 0 },
    });
    await db.catalog.create({
      data: { nameTr: 'b', nameEn: 'b', pdfUrl: '/b.pdf', coverImageUrl: '', sizeBytes: 1, sortOrder: 1 },
    });
    await db.promoBoard.create({
      data: {
        imageUrl: '/x',
        ...alt,
        titleTr: 'a',
        titleEn: 'a',
        subtitleTr: '',
        subtitleEn: '',
        catalogId: withCover.id,
        sortOrder: 0,
      },
    });
    await db.homeBanner.create({
      data: {
        id: 'home',
        imageUrl: '/x',
        ...text,
        primaryLabelTr: 'a',
        primaryLabelEn: 'a',
        primaryTarget: 'products',
        secondaryLabelTr: 'a',
        secondaryLabelEn: 'a',
        secondaryTarget: 'contact',
      },
    });
    expect((await getMissingContent()).imagesWithoutDescription).toEqual({
      services: 1,
      applicationAreas: 0,
      references: 1,
      promoBoards: 0,
      catalogs: 1,
      homeBanner: 1,
    });
  });
});
