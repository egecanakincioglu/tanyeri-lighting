import type { SiteSettings as SiteSettingsRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { type SiteSettings, siteSettingsSchema } from './schemas.ts';

// The business details live in one row with a fixed id.
const ROW_ID = 'site';

function fromRow(row: SiteSettingsRow): SiteSettings {
  return {
    siteName: fromColumns('siteName', row),
    logoUrl: row.logoUrl,
    phone: row.phone,
    email: row.email,
    address: fromColumns('address', row),
    workingHours: fromColumns('workingHours', row),
    serviceArea: fromColumns('serviceArea', row),
    languages: fromColumns('languages', row),
  };
}

function toColumnsOf(settings: SiteSettings) {
  return {
    ...toColumns('siteName', settings.siteName),
    logoUrl: settings.logoUrl,
    phone: settings.phone,
    email: settings.email,
    ...toColumns('address', settings.address),
    ...toColumns('workingHours', settings.workingHours),
    ...toColumns('serviceArea', settings.serviceArea),
    ...toColumns('languages', settings.languages),
  };
}

// Before the first save there is no row: every text, the phone and the email are empty and there is no logo. The result is only a default for
// readers; it is not stored, and saving still requires every field in both languages.
function emptySettings(): SiteSettings {
  const empty = () => ({ tr: '', en: '' });
  return {
    siteName: empty(),
    logoUrl: null,
    phone: '',
    email: '',
    address: empty(),
    workingHours: empty(),
    serviceArea: empty(),
    languages: empty(),
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await getDb().siteSettings.findUnique({ where: { id: ROW_ID } });
  return row ? fromRow(row) : emptySettings();
}

// Replaces all fields at once; creates the row on the first save.
export async function updateSiteSettings(input: unknown): Promise<SiteSettings> {
  assertWritable();
  const columns = toColumnsOf(siteSettingsSchema.parse(input));
  const row = await getDb().siteSettings.upsert({
    where: { id: ROW_ID },
    create: { id: ROW_ID, ...columns },
    update: columns,
  });
  return fromRow(row);
}
