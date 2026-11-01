import type { LegalPage as LegalPageRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { type LegalPage, type LegalPageKey, legalPageKeySchema, legalPageSchema } from './schemas.ts';

function fromRow(row: LegalPageRow): LegalPage {
  return { title: fromColumns('title', row), body: fromColumns('body', row), updatedAt: row.updatedAt };
}

// The body is Markdown text; render it with src/components/markdown-content.tsx, never as raw HTML.
export async function getLegalPage(key: LegalPageKey): Promise<LegalPage | null> {
  const row = await getDb().legalPage.findUnique({ where: { pageKey: key } });
  return row ? fromRow(row) : null;
}

export async function upsertLegalPage(key: unknown, input: unknown): Promise<LegalPage> {
  assertWritable();
  const pageKey = legalPageKeySchema.parse(key);
  const data = legalPageSchema.parse(input);
  const columns = { ...toColumns('title', data.title), ...toColumns('body', data.body) };
  const row = await getDb().legalPage.upsert({
    where: { pageKey },
    create: { pageKey, ...columns },
    update: columns,
  });
  return fromRow(row);
}
