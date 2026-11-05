import type { SiteSettings as SiteSettingsRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { type SiteSettings, siteSettingsSchema } from './schemas.ts';

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

// No row yet: texts, phone and email are empty and there is no logo. Not stored.
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
