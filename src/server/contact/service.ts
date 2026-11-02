import type { ContactMessage } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import type { ContactInput } from './form.ts';

// Not guarded: the public Server Action stores messages. The admin entry points that call the functions below
// check the session first (ADR 0003 rule 7).
export async function createContactMessage(input: ContactInput): Promise<void> {
  await getDb().contactMessage.create({ data: input });
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type MessagePage = {
  items: ContactMessage[];
  // The id to pass as `cursor` for the next page; null on the last page.
  nextCursor: string | null;
};

// Newest first. Pass the previous page's nextCursor to continue after it.
export async function listMessages({
  limit = DEFAULT_PAGE_SIZE,
  cursor,
}: { limit?: number; cursor?: string } = {}): Promise<MessagePage> {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(`limit must be an integer from 1 to ${MAX_PAGE_SIZE}`);
  }
  // One extra row tells whether another page follows.
  const rows = await getDb().contactMessage.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
}

export async function getMessage(id: string): Promise<ContactMessage | null> {
  return getDb().contactMessage.findUnique({ where: { id } });
}

// Keeps the first read time and does nothing for an unknown id.
export async function markMessageRead(id: string): Promise<void> {
  assertWritable();
  await getDb().contactMessage.updateMany({ where: { id, readAt: null }, data: { readAt: new Date() } });
}

export async function deleteMessage(id: string): Promise<void> {
  assertWritable();
  await getDb().contactMessage.deleteMany({ where: { id } });
}
