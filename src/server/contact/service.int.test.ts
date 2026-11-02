import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { deleteMessage, getMessage, listMessages, markMessageRead } from './service.ts';

const MINUTE = 60_000;
const BASE = Date.UTC(2026, 10, 1, 12, 0, 0);

async function seed(count: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = await getDb().contactMessage.create({
      data: {
        name: `Visitor ${i}`,
        email: `visitor${i}@example.com`,
        subject: `Subject ${i}`,
        message: `Message ${i}`,
        locale: i % 2 === 0 ? 'tr' : 'en',
        createdAt: new Date(BASE + i * MINUTE),
      },
    });
    ids.push(row.id);
  }
  return ids;
}

describe('contact message services on a real database', () => {
  beforeEach(async () => {
    await getDb().contactMessage.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  describe('getMessage', () => {
    it('returns one message with all of its text, and null for an unknown id', async () => {
      const [id] = await seed(1);
      expect(await getMessage(id!)).toMatchObject({ id, name: 'Visitor 0', message: 'Message 0', readAt: null });
      expect(await getMessage('missing')).toBeNull();
    });
  });

  describe('listMessages', () => {
    it('is empty when there are no messages', async () => {
      expect(await listMessages()).toEqual({ items: [], nextCursor: null });
    });

    it('returns the newest message first', async () => {
      const ids = await seed(3);
      const page = await listMessages();
      expect(page.items.map((item) => item.id)).toEqual([...ids].reverse());
      expect(page.nextCursor).toBeNull();
    });

    it('pages with a cursor until the last page', async () => {
      const ids = await seed(5);
      const newestFirst = [...ids].reverse();

      const first = await listMessages({ limit: 2 });
      expect(first.items.map((item) => item.id)).toEqual(newestFirst.slice(0, 2));
      expect(first.nextCursor).toBe(newestFirst[1]);

      const second = await listMessages({ limit: 2, ...(first.nextCursor ? { cursor: first.nextCursor } : {}) });
      expect(second.items.map((item) => item.id)).toEqual(newestFirst.slice(2, 4));
      expect(second.nextCursor).toBe(newestFirst[3]);

      const third = await listMessages({ limit: 2, ...(second.nextCursor ? { cursor: second.nextCursor } : {}) });
      expect(third.items.map((item) => item.id)).toEqual(newestFirst.slice(4));
      expect(third.nextCursor).toBeNull();
    });

    it('has no next page when the count equals the limit', async () => {
      await seed(2);
      expect((await listMessages({ limit: 2 })).nextCursor).toBeNull();
    });

    it('keeps a stable order for messages created at the same time', async () => {
      const db = getDb();
      const createdAt = new Date(BASE);
      for (let i = 0; i < 4; i++) {
        await db.contactMessage.create({
          data: { name: 'n', email: 'a@example.com', subject: 's', message: 'm', locale: 'tr', createdAt },
        });
      }
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await listMessages({ limit: 1, ...(cursor ? { cursor } : {}) });
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(new Set(seen).size).toBe(4);
    });

    it.each([0, -1, 1.5, 101])('rejects the limit %s', async (limit) => {
      await expect(listMessages({ limit })).rejects.toThrow(RangeError);
    });
  });

  describe('markMessageRead', () => {
    it('sets the read time once and keeps the first one', async () => {
      const [id = ''] = await seed(1);
      await markMessageRead(id);
      const first = await getDb().contactMessage.findUniqueOrThrow({ where: { id } });
      expect(first.readAt).toBeInstanceOf(Date);

      await markMessageRead(id);
      const second = await getDb().contactMessage.findUniqueOrThrow({ where: { id } });
      expect(second.readAt).toEqual(first.readAt);
    });

    it('leaves other messages unread and ignores an unknown id', async () => {
      const [id = '', other = ''] = await seed(2);
      await markMessageRead('does-not-exist');
      await markMessageRead(id);
      expect((await getDb().contactMessage.findUniqueOrThrow({ where: { id: other } })).readAt).toBeNull();
    });

    it('is refused in demo mode and changes nothing', async () => {
      const [id = ''] = await seed(1);
      vi.stubEnv('DEMO_MODE', 'true');
      await expect(markMessageRead(id)).rejects.toThrow(DemoModeError);
      expect((await getDb().contactMessage.findUniqueOrThrow({ where: { id } })).readAt).toBeNull();
    });
  });

  describe('deleteMessage', () => {
    it('removes only the chosen message', async () => {
      const [id = '', other = ''] = await seed(2);
      await deleteMessage(id);
      const left = await getDb().contactMessage.findMany();
      expect(left.map((row) => row.id)).toEqual([other]);
    });

    it('ignores an unknown id', async () => {
      await seed(1);
      await deleteMessage('does-not-exist');
      expect(await getDb().contactMessage.count()).toBe(1);
    });

    it('is refused in demo mode and changes nothing', async () => {
      const [id = ''] = await seed(1);
      vi.stubEnv('DEMO_MODE', 'true');
      await expect(deleteMessage(id)).rejects.toThrow(DemoModeError);
      expect(await getDb().contactMessage.count()).toBe(1);
    });
  });
});
