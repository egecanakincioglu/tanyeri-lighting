import type { PageMetadata as PageMetadataRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { type PageKey, type PageMetadata, pageKeySchema, pageMetadataSchema } from './schemas.ts';

function fromRow(row: PageMetadataRow): PageMetadata {
  return {
    title: fromColumns('title', row),
    description: fromColumns('description', row),
    updatedAt: row.updatedAt,
  };
}

// No row means null, never another page or language text.
export async function getPageMetadata(key: PageKey): Promise<PageMetadata | null> {
  const row = await getDb().pageMetadata.findUnique({ where: { pageKey: key } });
  return row ? fromRow(row) : null;
}

export async function upsertPageMetadata(key: unknown, input: unknown): Promise<PageMetadata> {
  assertWritable();
  const pageKey = pageKeySchema.parse(key);
  const data = pageMetadataSchema.parse(input);
  const columns = { ...toColumns('title', data.title), ...toColumns('description', data.description) };
  const row = await getDb().pageMetadata.upsert({
    where: { pageKey },
    create: { pageKey, ...columns },
    update: columns,
  });
  return fromRow(row);
}
