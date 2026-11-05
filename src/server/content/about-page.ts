import type { AboutPage as AboutPageRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { type AboutPage, aboutPageSchema } from './schemas.ts';

const ROW_ID = 'about';

function fromRow(row: AboutPageRow): AboutPage {
  return { body: fromColumns('body', row), vision: fromColumns('vision', row) };
}

function toColumnsOf(page: AboutPage) {
  return { ...toColumns('body', page.body), ...toColumns('vision', page.vision) };
}

// No row yet: both texts are empty. This default is not stored.
// Markdown: render it with markdown-content.tsx, never as raw HTML.
export async function getAboutPage(): Promise<AboutPage> {
  const row = await getDb().aboutPage.findUnique({ where: { id: ROW_ID } });
  return row ? fromRow(row) : { body: { tr: '', en: '' }, vision: { tr: '', en: '' } };
}

export async function updateAboutPage(input: unknown): Promise<AboutPage> {
  assertWritable();
  const columns = toColumnsOf(aboutPageSchema.parse(input));
  const row = await getDb().aboutPage.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, ...columns },
    update: columns,
  });
  return fromRow(row);
}
