import type { AboutPage as AboutPageRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { type AboutPage, aboutPageSchema } from './schemas.ts';

// The about page lives in one row with a fixed id.
const ROW_ID = 'about';

function fromRow(row: AboutPageRow): AboutPage {
  return { body: fromColumns('body', row), vision: fromColumns('vision', row) };
}

function toColumnsOf(page: AboutPage) {
  return { ...toColumns('body', page.body), ...toColumns('vision', page.vision) };
}

// Before the first save there is no row: both texts are empty. The result is only a default for readers; it is not
// stored, and saving still requires both texts in both languages.
// The texts are Markdown; render them with src/components/markdown-content.tsx, never as raw HTML.
export async function getAboutPage(): Promise<AboutPage> {
  const row = await getDb().aboutPage.findUnique({ where: { id: ROW_ID } });
  return row ? fromRow(row) : { body: { tr: '', en: '' }, vision: { tr: '', en: '' } };
}

// Replaces both texts at once; creates the row on the first save.
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
