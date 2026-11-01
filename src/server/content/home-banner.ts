import type { HomeBanner as HomeBannerRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { type HomeBanner, homeBannerSchema, pageKeySchema } from './schemas.ts';

// The banner lives in one row with a fixed id.
const ROW_ID = 'home';

function fromRow(row: HomeBannerRow): HomeBanner {
  return {
    imageUrl: row.imageUrl,
    title: fromColumns('title', row),
    description: fromColumns('description', row),
    primaryAction: { label: fromColumns('primaryLabel', row), target: pageKeySchema.parse(row.primaryTarget) },
    secondaryAction: { label: fromColumns('secondaryLabel', row), target: pageKeySchema.parse(row.secondaryTarget) },
  };
}

function toColumnsOf(banner: HomeBanner) {
  return {
    imageUrl: banner.imageUrl,
    ...toColumns('title', banner.title),
    ...toColumns('description', banner.description),
    ...toColumns('primaryLabel', banner.primaryAction.label),
    primaryTarget: banner.primaryAction.target,
    ...toColumns('secondaryLabel', banner.secondaryAction.label),
    secondaryTarget: banner.secondaryAction.target,
  };
}

// Before the first save there is no row: the texts and the image are empty, and the buttons point at the product list
// and the contact page. The result is only a default for readers; it is not stored, and saving still requires every
// field in both languages.
function emptyBanner(): HomeBanner {
  const empty = () => ({ tr: '', en: '' });
  return {
    imageUrl: '',
    title: empty(),
    description: empty(),
    primaryAction: { label: empty(), target: 'products' },
    secondaryAction: { label: empty(), target: 'contact' },
  };
}

export async function getHomeBanner(): Promise<HomeBanner> {
  const row = await getDb().homeBanner.findUnique({ where: { id: ROW_ID } });
  return row ? fromRow(row) : emptyBanner();
}

// Replaces all fields at once; creates the row on the first save.
export async function updateHomeBanner(input: unknown): Promise<HomeBanner> {
  assertWritable();
  const columns = toColumnsOf(homeBannerSchema.parse(input));
  const row = await getDb().homeBanner.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, ...columns },
    update: columns,
  });
  return fromRow(row);
}
