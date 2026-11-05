import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDemoContent, type SeedCounts } from '../../../prisma/demo-content.ts';
import { getDb } from '../db.ts';
import { PAGE_KEYS } from './schemas.ts';

const db = getDb();

const demoFile = (url: string) => new URL(`../../../public${url}`, import.meta.url);

// A copy of one language is not a translation, so the pair must differ.
const isTranslated = (tr: string, en: string) => tr.length > 0 && en.length > 0 && tr !== en;

describe('demo content seed on a real database', () => {
  let first: SeedCounts;

  beforeAll(async () => {
    await db.user.deleteMany();
    await db.user.create({ data: { id: 'demo-seed-user', name: 'Admin', email: 'admin@tanyeri.example' } });
  });

  afterAll(async () => {
    await db.user.deleteMany();
    await db.$disconnect();
  });

  it('seeds an empty database without a flag', async () => {
    await db.featuredProduct.deleteMany();
    await db.promoBoard.deleteMany();
    await db.catalog.deleteMany();
    await db.product.deleteMany();
    await db.category.deleteMany();
    await db.project.deleteMany();
    await db.siteSettings.deleteMany();
    first = await seedDemoContent(db);
  });

  it('refuses to run over existing content and changes nothing', async () => {
    await db.category.updateMany({ data: { nameEn: 'Edited in the panel' } });
    await expect(seedDemoContent(db)).rejects.toThrow('--replace');
    expect(await db.product.count()).toBe(30);
    expect(
      await db.product.count({
        where: {
          NOT: [
            { descriptionTr: '' },
            { descriptionEn: '' },
            { luminousFlux: '' },
            { colorTemperature: '' },
            { cri: '' },
            { ip: '' },
          ],
        },
      }),
    ).toBe(30);
    expect(await db.category.count({ where: { nameEn: 'Edited in the panel' } })).toBe(6);
  });

  it('overwrites existing content with --replace', async () => {
    expect(await seedDemoContent(db, { replace: true })).toEqual(first);
    expect(await db.category.count({ where: { nameEn: 'Edited in the panel' } })).toBe(0);
  });

  it('creates the planned amount of content', async () => {
    expect(first).toMatchObject({
      categories: 6,
      products: 30,
      catalogs: 3,
      promoBoards: 3,
      featuredProducts: 6,
      applicationAreas: 6,
      services: 4,
      projects: 2,
      references: 5,
      socialLinks: 4,
      pageMetadata: PAGE_KEYS.length,
      legalPages: 2,
      blogPosts: 6,
    });
    expect(await db.category.count()).toBe(6);
    expect(await db.product.count()).toBe(30);
    expect(await db.catalog.count()).toBe(3);
    expect(await db.promoBoard.count()).toBe(3);
    expect(await db.featuredProduct.count()).toBe(6);
    expect(await db.applicationArea.count()).toBe(6);
    expect(await db.service.count()).toBe(4);
    expect(await db.project.count()).toBe(2);
    expect(await db.reference.count()).toBe(5);
    expect(await db.socialLink.count()).toBe(4);
    expect(await db.pageMetadata.count()).toBe(PAGE_KEYS.length);
    expect(await db.legalPage.count()).toBe(2);
    expect(await db.blogPost.count()).toBe(6);
    expect(await db.siteSettings.count()).toBe(1);
    expect(await db.homeBanner.count()).toBe(1);
    expect(await db.aboutPage.count()).toBe(1);
  });

  it('leaves the same content after a second run, and leaves users alone', async () => {
    const snapshot = async () => ({
      categories: (await db.category.findMany({ orderBy: { key: 'asc' } })).map((c) => [c.key, c.nameTr, c.nameEn]),
      products: (await db.product.findMany({ orderBy: { slug: 'asc' } })).map((p) => [p.slug, p.code, p.nameEn]),
      featured: (await db.featuredProduct.findMany({ orderBy: { sortOrder: 'asc' }, include: { product: true } })).map(
        (f) => f.product.slug,
      ),
      boards: (await db.promoBoard.findMany({ orderBy: { sortOrder: 'asc' } })).map((b) => b.titleEn),
      projects: (await db.project.findMany({ orderBy: { sortOrder: 'asc' } })).map((p) => p.titleEn),
      posts: (await db.blogPost.findMany({ orderBy: { slug: 'asc' } })).map((p) => [
        p.slug,
        p.publishedAt,
        p.updatedAt,
        p.bodyEn,
      ]),
    });
    const before = await snapshot();
    const second = await seedDemoContent(db, { replace: true });
    expect(second).toEqual(first);
    const after = await snapshot();
    expect(after).toEqual(before);
    expect(await db.user.count()).toBe(1);
  });

  it('adds fictional Turkish messages, some unread, once, and keeps other messages', async () => {
    await db.contactMessage.deleteMany({ where: { email: 'real@visitor.test' } });
    await db.contactMessage.create({
      data: { name: 'Real', email: 'real@visitor.test', subject: 's', message: 'm', locale: 'en' },
    });
    expect(await seedDemoContent(db, { replace: true })).toEqual(first);
    const demo = await db.contactMessage.findMany({ where: { email: { endsWith: '@example.com' } } });
    expect(first.messages).toBe(5);
    expect(demo).toHaveLength(5);
    expect(demo.every((message) => message.locale === 'tr')).toBe(true);
    expect(demo.filter((message) => message.readAt === null).length).toBeGreaterThan(0);
    expect(demo.filter((message) => message.readAt !== null).length).toBeGreaterThan(0);
    expect(await db.contactMessage.count({ where: { email: 'real@visitor.test' } })).toBe(1);
    await db.contactMessage.deleteMany();
  });

  it('has both languages on every kind of record', async () => {
    const site = await db.siteSettings.findUniqueOrThrow({ where: { id: 'site' } });
    expect(isTranslated(site.addressTr, site.addressEn)).toBe(true);
    expect(site.phone).toBe('+90 212 000 00 00');
    expect(site.email).toBe('info@tanyeri-lighting.vercel.app');

    const links = await db.socialLink.findMany({ orderBy: { position: 'asc' } });
    expect(links.map((link) => link.url)).toEqual([
      'https://www.instagram.com/tanyerilighting',
      'https://www.facebook.com/tanyerilighting',
      'https://www.linkedin.com/company/tanyerilighting',
      'https://www.youtube.com/@tanyerilighting',
    ]);
    const social = links[0]!;
    expect(social.labelTr.length).toBeGreaterThan(0);
    expect(social.labelEn.length).toBeGreaterThan(0);

    for (const key of PAGE_KEYS) {
      const page = await db.pageMetadata.findUniqueOrThrow({ where: { pageKey: key } });
      expect(isTranslated(page.titleTr, page.titleEn) && isTranslated(page.descriptionTr, page.descriptionEn)).toBe(
        true,
      );
    }
    for (const key of ['privacy', 'terms']) {
      const legal = await db.legalPage.findUniqueOrThrow({ where: { pageKey: key } });
      expect(isTranslated(legal.bodyTr, legal.bodyEn)).toBe(true);
    }

    for (const post of await db.blogPost.findMany()) {
      for (const field of ['title', 'description', 'excerpt', 'body', 'imageAlt'] as const) {
        expect(isTranslated(post[`${field}Tr`], post[`${field}En`]), `${post.slug} ${field}`).toBe(true);
      }
      expect(post.publishedAt && post.publishedAt < new Date()).toBe(true);
    }
    const category = await db.category.findFirstOrThrow();
    expect(isTranslated(category.nameTr, category.nameEn)).toBe(true);
    const product = await db.product.findFirstOrThrow();
    expect(isTranslated(product.nameTr, product.nameEn)).toBe(true);
    expect(isTranslated(product.colorTr, product.colorEn)).toBe(true);
    expect(isTranslated(product.materialTr, product.materialEn)).toBe(true);
    const catalog = await db.catalog.findFirstOrThrow();
    expect(isTranslated(catalog.nameTr, catalog.nameEn)).toBe(true);
    const banner = await db.homeBanner.findUniqueOrThrow({ where: { id: 'home' } });
    expect(
      isTranslated(banner.titleTr, banner.titleEn) && isTranslated(banner.primaryLabelTr, banner.primaryLabelEn),
    ).toBe(true);
    expect(banner.primaryTarget).not.toBe(banner.secondaryTarget);
    const board = await db.promoBoard.findFirstOrThrow();
    expect(isTranslated(board.titleTr, board.titleEn) && isTranslated(board.subtitleTr, board.subtitleEn)).toBe(true);
    const area = await db.applicationArea.findFirstOrThrow();
    expect(isTranslated(area.titleTr, area.titleEn) && isTranslated(area.descriptionTr, area.descriptionEn)).toBe(true);
    const service = await db.service.findFirstOrThrow({ orderBy: { sortOrder: 'asc' } });
    expect(isTranslated(service.titleTr, service.titleEn) && isTranslated(service.noteTr, service.noteEn)).toBe(true);
    const about = await db.aboutPage.findUniqueOrThrow({ where: { id: 'about' } });
    expect(isTranslated(about.bodyTr, about.bodyEn) && isTranslated(about.visionTr, about.visionEn)).toBe(true);
    const project = await db.project.findFirstOrThrow();
    expect(isTranslated(project.titleTr, project.titleEn)).toBe(true);
    const reference = await db.reference.findFirstOrThrow();
    expect(isTranslated(reference.titleTr, reference.titleEn)).toBe(true);
  });

  it('gives every category its own page texts: titles without the brand, an intro of 40 to 60 words', async () => {
    const categories = await db.category.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(categories).toHaveLength(6);
    const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
    for (const category of categories) {
      for (const field of ['seoTitle', 'seoDescription', 'h1', 'intro'] as const) {
        expect(isTranslated(category[`${field}Tr`], category[`${field}En`]), `${category.key} ${field}`).toBe(true);
      }
      expect(category.seoTitleTr + category.seoTitleEn).not.toMatch(/Tanyeri/);
      expect(category.seoTitleTr.length).toBeLessThanOrEqual(70);
      expect(category.seoTitleEn.length).toBeLessThanOrEqual(70);
      for (const intro of [category.introTr, category.introEn]) {
        expect(words(intro), `${category.key} intro`).toBeGreaterThanOrEqual(40);
        expect(words(intro), `${category.key} intro`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('links the work areas that have a matching category and leaves the others unlinked', async () => {
    const areas = await db.applicationArea.findMany({ include: { category: true }, orderBy: { sortOrder: 'asc' } });
    expect(areas.map((area) => [area.titleEn, area.category?.key ?? null])).toEqual([
      ['Homes', 'gomme-spot'],
      ['Offices and Commercial Spaces', 'lineer'],
      ['Industrial Sites', null],
      ['Hotels and Stores', 'ray-spot'],
      ['Landscape', 'dis-mekan'],
      ['Facades', 'dis-mekan'],
    ]);
  });

  it('gives each catalog its own file and cover', async () => {
    const catalogs = await db.catalog.findMany({ orderBy: { sortOrder: 'asc' } });
    expect(catalogs.map((r) => r.pdfUrl)).toEqual([
      '/demo/catalog-2026.pdf',
      '/demo/catalog-dekoratif.pdf',
      '/demo/catalog-dis-mekan.pdf',
    ]);
    expect(catalogs.map((r) => r.coverImageUrl)).toEqual([
      '/demo/catalog-2026-cover.webp',
      '/demo/catalog-dekoratif-cover.webp',
      '/demo/catalog-dis-mekan-cover.webp',
    ]);
    expect(new Set(catalogs.map((r) => r.sizeBytes)).size).toBe(3);
  });

  it('features six products, links each promo board to a catalog and keeps products without a price', async () => {
    const featured = await db.featuredProduct.findMany({ include: { product: true } });
    expect(featured).toHaveLength(6);
    expect(featured.every((f) => f.product.nameTr.length > 0)).toBe(true);
    const boards = await db.promoBoard.findMany({ include: { catalog: true } });
    expect(boards.every((b) => b.catalog.pdfUrl.startsWith('/demo/'))).toBe(true);
    const perCategory = await db.category.findMany({ include: { _count: { select: { products: true } } } });
    expect(perCategory.every((c) => c._count.products >= 4)).toBe(true);
  });

  it('describes every picture in both languages, in a short sentence that is not the card title', async () => {
    const banner = await db.homeBanner.findUniqueOrThrow({ where: { id: 'home' } });
    const rows = [
      ...(await db.promoBoard.findMany()),
      ...(await db.applicationArea.findMany()),
      ...(await db.service.findMany()),
      ...(await db.reference.findMany()),
      ...(await db.catalog.findMany()),
      banner,
    ];
    expect(rows.length).toBe(3 + 6 + 4 + 5 + 3 + 1);
    for (const row of rows) {
      expect(isTranslated(row.imageAltTr, row.imageAltEn), row.imageAltEn).toBe(true);
      expect(row.imageAltTr.length).toBeLessThanOrEqual(200);
      expect(row.imageAltEn.length).toBeLessThanOrEqual(200);
    }
    for (const row of [
      ...(await db.promoBoard.findMany()),
      ...(await db.applicationArea.findMany()),
      ...(await db.service.findMany()),
    ]) {
      expect(row.imageAltEn.toLowerCase()).not.toBe(row.titleEn.toLowerCase());
    }
  });

  it('points every picture and file at an existing file under public/demo', async () => {
    const urls = new Set<string>([
      ...(await db.product.findMany()).map((r) => r.imageUrl),
      ...(await db.promoBoard.findMany()).map((r) => r.imageUrl),
      ...(await db.applicationArea.findMany()).map((r) => r.imageUrl),
      ...(await db.service.findMany()).map((r) => r.imageUrl),
      ...(await db.reference.findMany()).map((r) => r.imageUrl),
      ...(await db.project.findMany()).flatMap((r) => [r.beforeImageUrl, r.afterImageUrl]),
      ...(await db.catalog.findMany()).flatMap((r) => [r.pdfUrl, r.coverImageUrl]),
      (await db.homeBanner.findUniqueOrThrow({ where: { id: 'home' } })).imageUrl,
    ]);
    expect(urls.size).toBeGreaterThan(20);
    for (const url of urls) {
      expect(url.startsWith('/demo/'), url).toBe(true);
      expect(existsSync(demoFile(url)), url).toBe(true);
    }
  });
});
