import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../auth/guard.ts';
import { createContactMessage } from '../contact/service.ts';
import { getDb } from '../db.ts';
import { markMessageReadAction } from './messages-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), refresh: vi.fn() }));

vi.mock('../auth/guard.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/guard.ts')>()),
  guardAction: mocks.guardAction,
}));
vi.mock('next/cache', () => ({ refresh: mocks.refresh }));

async function unreadCount(): Promise<number> {
  return getDb().contactMessage.count({ where: { readAt: null } });
}

describe('markMessageReadAction on a real database', () => {
  let id = '';

  beforeEach(async () => {
    await getDb().contactMessage.deleteMany();
    await createContactMessage({
      name: 'Ayse',
      email: 'ayse@example.com',
      subject: 'Quote',
      message: 'Hello there',
      locale: 'en',
    });
    await createContactMessage({
      name: 'Can',
      email: 'can@example.com',
      subject: 'Quote',
      message: 'Hello again',
      locale: 'en',
    });
    id = (await getDb().contactMessage.findFirstOrThrow({ orderBy: { createdAt: 'asc' } })).id;
    mocks.guardAction.mockReset();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.refresh.mockClear();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('marks the given message read and nothing else', async () => {
    await markMessageReadAction(id);
    expect(await unreadCount()).toBe(1);
    expect((await getDb().contactMessage.findUniqueOrThrow({ where: { id } })).readAt).not.toBeNull();
  });

  it('refuses an argument that is not an id, so it can not widen the query', async () => {
    await markMessageReadAction({ not: 'no-such-id' } as unknown as string);
    await markMessageReadAction('');
    expect(await unreadCount()).toBe(2);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('marks nothing without a session', async () => {
    mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    await markMessageReadAction(id);
    expect(await unreadCount()).toBe(2);
  });
});
