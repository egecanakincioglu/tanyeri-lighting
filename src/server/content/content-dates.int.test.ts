import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.ts';
import { createApplicationArea } from './application-areas.ts';
import { createCatalog } from './catalogs.ts';
import { listContentDates, newest } from './content-dates.ts';
import { createCategory } from './categories.ts';
import { setFeaturedProducts } from './featured-products.ts';
import { updateHomeBanner } from './home-banner.ts';
import { createProduct } from './products.ts';
import { createProject } from './projects.ts';
import { createPromoBoard } from './promo-boards.ts';
import { createReference } from './references.ts';
import { createService } from './services.ts';

const pair = (tr: string, en: string) => ({ tr, en });
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

describe('newest', () => {
  it('gives the latest date and ignores missing ones', () => {
    expect(newest(day('2026-01-01'), null, day('2026-03-01'), undefined, day('2026-02-01'))).toEqual(day('2026-03-01'));
    expect(newest(null, undefined)).toBeUndefined();
    expect(newest()).toBeUndefined();
  });
});

describe('content dates on a real database', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.featuredProduct.deleteMany();
    await db.homeBanner.deleteMany();
    await db.promoBoard.deleteMany();
    await db.applicationArea.deleteMany();
    await db.product.deleteMany();
    await db.category.deleteMany();
    await db.catalog.deleteMany();
    await db.service.deleteMany();
    await db.project.deleteMany();
    await db.reference.deleteMany();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('has no date for a page whose tables are empty', async () => {
    expect(await listContentDates()).toEqual({});
  });

  it('dates each page by the newest row of the tables it shows', async () => {
    const db = getDb();
    await createService({
      imageUrl: 'https://store.example.com/s.webp',
      imageAlt: { tr: '', en: '' },
      title: pair('Hizmet', 'Service'),
      description: pair('Açıklama', 'Description'),
      note: pair('Not', 'Note'),
    });
    await createService({
      imageUrl: 'https://store.example.com/s2.webp',
      imageAlt: { tr: '', en: '' },
      title: pair('Hizmet 2', 'Service 2'),
      description: pair('Açıklama', 'Description'),
      note: pair('Not', 'Note'),
    });
    await createProject({
      title: pair('İş', 'Work'),
      description: pair('Açıklama', 'Description'),
      beforeImageUrl: 'https://store.example.com/b.webp',
      afterImageUrl: 'https://store.example.com/a.webp',
    });
    await createReference({
      imageUrl: 'https://store.example.com/r.webp',
      imageAlt: { tr: '', en: '' },
      name: 'Acme',
      title: pair('İş', 'Work'),
      description: pair('Açıklama', 'Description'),
    });
    const catalog = await createCatalog({
      name: pair('Genel', 'General'),
      pdfUrl: 'https://store.example.com/g.pdf',
      coverImageUrl: '',
      imageAlt: { tr: '', en: '' },
      sizeBytes: 1000,
    });
    await db.service.updateMany({ data: { updatedAt: day('2026-01-01') } });
    await db.service.updateMany({ where: { titleEn: 'Service 2' }, data: { updatedAt: day('2026-01-05') } });
    await db.project.updateMany({ data: { updatedAt: day('2026-02-01') } });
    await db.reference.updateMany({ data: { updatedAt: day('2026-03-01') } });
    await db.catalog.updateMany({ data: { updatedAt: day('2026-04-01') } });

    const dates = await listContentDates();
    expect(dates).toEqual({
      services: day('2026-01-05'),
      projects: day('2026-02-01'),
      references: day('2026-03-01'),
      catalogs: day('2026-04-01'),
    });

    await createPromoBoard({
      imageUrl: 'https://store.example.com/p.webp',
      imageAlt: { tr: '', en: '' },
      title: pair('Pano', 'Board'),
      subtitle: pair('Alt', 'Sub'),
      catalogId: catalog.id,
    });
    await db.promoBoard.updateMany({ data: { updatedAt: day('2026-05-01') } });
    expect((await listContentDates()).home).toEqual(day('2026-05-01'));
  });

  it('dates the home page by the banner, the boards, the areas and the featured products', async () => {
    const db = getDb();
    const none = pair('', '');
    const category = await createCategory({
      key: 'indoor',
      name: pair('İç', 'Indoor'),
      seoTitle: none,
      seoDescription: none,
      h1: none,
      intro: none,
    });
    const product = await createProduct({
      categoryId: category.id,
      slug: 'ring',
      code: 'RING',
      name: pair('Halka', 'Ring'),
      color: pair('Siyah', 'Black'),
      material: pair('Alüminyum', 'Aluminium'),
      power: '12 W',
      dimensions: '120 mm',
      imageUrl: 'https://store.example.com/ring.webp',
    });
    await db.product.updateMany({ data: { updatedAt: day('2026-01-01') } });
    expect((await listContentDates()).home).toBeUndefined();

    await setFeaturedProducts([product.id]);
    const featuredAt = (await db.featuredProduct.findFirstOrThrow()).createdAt;
    expect((await listContentDates()).home).toEqual(featuredAt);

    await db.product.updateMany({ data: { updatedAt: new Date(featuredAt.getTime() + 60_000) } });
    expect((await listContentDates()).home).toEqual(new Date(featuredAt.getTime() + 60_000));

    await createApplicationArea({
      imageUrl: 'https://store.example.com/a.webp',
      imageAlt: { tr: '', en: '' },
      title: pair('Alan', 'Area'),
      description: pair('Açıklama', 'Description'),
      categoryId: null,
    });
    await db.applicationArea.updateMany({ data: { updatedAt: day('2099-01-01') } });
    expect((await listContentDates()).home).toEqual(day('2099-01-01'));

    await updateHomeBanner({
      imageUrl: 'https://store.example.com/banner.webp',
      imageAlt: { tr: '', en: '' },
      title: pair('Işık', 'Light'),
      description: pair('Açıklama', 'Description'),
      primaryAction: { label: pair('Ürünler', 'Products'), target: 'products' },
      secondaryAction: { label: pair('İletişim', 'Contact'), target: 'contact' },
    });
    await db.homeBanner.updateMany({ data: { updatedAt: day('2100-01-01') } });
    expect((await listContentDates()).home).toEqual(day('2100-01-01'));
  });

  it('leaves out the product list, which the sitemap dates itself', async () => {
    const category = await createCategory({ key: 'indoor', name: pair('İç', 'Indoor') });
    expect(category.id).toBeTruthy();
    expect(await listContentDates()).not.toHaveProperty('products');
  });
});
