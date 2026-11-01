import type { SocialLink as SocialLinkRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, InvalidOrderError, isRecordNotFound } from './errors.ts';
import {
  type SocialLink,
  socialLinkIdSchema,
  socialLinkOrderSchema,
  socialLinkSchema,
  type SocialLinkInput,
} from './schemas.ts';

function fromRow(row: SocialLinkRow): SocialLink {
  return { id: row.id, platform: row.platform, label: fromColumns('label', row), url: row.url };
}

function toColumnsOf(link: SocialLinkInput) {
  return { platform: link.platform, ...toColumns('label', link.label), url: link.url };
}

export async function listSocialLinks(): Promise<SocialLink[]> {
  const rows = await getDb().socialLink.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] });
  return rows.map(fromRow);
}

// The new link goes to the end of the list.
export async function createSocialLink(input: unknown): Promise<SocialLink> {
  assertWritable();
  const columns = toColumnsOf(socialLinkSchema.parse(input));
  const row = await getDb().$transaction(async (tx) => {
    const last = await tx.socialLink.aggregate({ _max: { position: true } });
    return tx.socialLink.create({ data: { ...columns, position: (last._max.position ?? -1) + 1 } });
  });
  return fromRow(row);
}

export async function updateSocialLink(id: unknown, input: unknown): Promise<SocialLink> {
  assertWritable();
  const linkId = socialLinkIdSchema.parse(id);
  const columns = toColumnsOf(socialLinkSchema.parse(input));
  try {
    return fromRow(await getDb().socialLink.update({ where: { id: linkId }, data: columns }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Social link');
    throw error;
  }
}

export async function deleteSocialLink(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().socialLink.deleteMany({ where: { id: socialLinkIdSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Social link');
}

// `ids` is the complete list in its new order; a missing, extra or repeated id changes nothing.
export async function reorderSocialLinks(ids: unknown): Promise<void> {
  assertWritable();
  const order = socialLinkOrderSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    const existing = await tx.socialLink.findMany({ select: { id: true } });
    const known = new Set(existing.map((link) => link.id));
    if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
      throw new InvalidOrderError();
    }
    for (const [position, id] of order.entries()) {
      await tx.socialLink.update({ where: { id }, data: { position } });
    }
  });
}
