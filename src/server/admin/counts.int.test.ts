import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getDb } from '../db.ts';
import { countUnreadMessages, getPanelCounts } from './counts.ts';

function message(readAt: Date | null) {
  return { name: 'Ada', email: 'ada@example.com', subject: 'Hello', message: 'Hi', locale: 'en', readAt };
}

describe('panel counts on a real database', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.contactMessage.deleteMany();
    await db.reference.deleteMany();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('counts messages, unread messages and references', async () => {
    const db = getDb();
    await db.contactMessage.createMany({ data: [message(null), message(null), message(new Date())] });
    await db.reference.create({
      data: {
        imageUrl: '/demo/area-otel.webp',
        name: 'Alpha',
        titleTr: 'a',
        titleEn: 'a',
        descriptionTr: 'a',
        descriptionEn: 'a',
        sortOrder: 0,
      },
    });
    const counts = await getPanelCounts();
    expect(counts).toMatchObject({ messages: 3, unreadMessages: 2, references: 1 });
    expect(counts).toMatchObject({
      products: await db.product.count(),
      categories: await db.category.count(),
      catalogs: await db.catalog.count(),
      projects: await db.project.count(),
      services: await db.service.count(),
      blogPosts: await db.blogPost.count(),
    });
    expect(await countUnreadMessages()).toBe(2);
  });

  it('is all zero on an empty database', async () => {
    expect(await countUnreadMessages()).toBe(0);
    expect((await getPanelCounts()).messages).toBe(0);
  });
});
