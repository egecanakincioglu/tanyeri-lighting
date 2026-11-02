import { randomUUID } from 'node:crypto';
import { getDb } from '../db.ts';

export type VisitInput = {
  country: string | null;
  city: string | null;
  // Already anonymized (see anonymize.ts); this module never sees a plain address.
  address: string;
};

export type DayStat = { day: string; visits: number; views: number };
export type CountryStat = { country: string | null; visits: number; views: number };
export type VisitStats = {
  days: DayStat[];
  countries: CountryStat[];
  totals: { visits: number; views: number };
};

export const STATS_DAYS = 30;
const RETENTION_MONTHS = 13;
const DAY_MS = 24 * 60 * 60 * 1000;
// Statistics follow the business's calendar, not UTC.
const TIME_ZONE = 'Europe/Istanbul';

// Without a scheduled job the table is trimmed by the writes themselves, once a day per server instance.
let lastPurge = 0;

function istanbulDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

async function purgeOldVisits(now: number): Promise<void> {
  if (now - lastPurge < DAY_MS) return;
  lastPurge = now;
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS);
  await getDb().visit.deleteMany({ where: { day: { lt: new Date(istanbulDay(cutoff)) } } });
}

// One row per day and address: the first request of the day inserts it, every later one only adds to `views`, in one
// statement so concurrent requests can not lose a count. Country and city stay as the first request had them.
export async function recordVisit(input: VisitInput): Promise<void> {
  const now = Date.now();
  const day = istanbulDay(new Date(now));
  await getDb().$executeRaw`
    INSERT INTO "visit" ("id", "day", "address", "country", "city", "views")
    VALUES (${randomUUID()}, ${day}::date, ${input.address}, ${input.country}, ${input.city}, 1)
    ON CONFLICT ("day", "address") DO UPDATE SET "views" = "visit"."views" + 1`;
  await purgeOldVisits(now);
}

/** The last 30 calendar days (today included) as `YYYY-MM-DD`, oldest first. */
export function lastDays(now: Date, count: number = STATS_DAYS): string[] {
  const [year = 0, month = 1, day = 1] = istanbulDay(now).split('-').map(Number);
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(year, month - 1, day - (count - 1 - index))).toISOString().slice(0, 10),
  );
}

// A visit is one visitor address (the anonymized /24 or /48) in a period, so it is an estimate: visitors on one
// network count once. A page view is one request counted in `views`. The queries compare the plain `day` column, so
// its index is used.
export async function getVisitStats(now: Date = new Date()): Promise<VisitStats> {
  const db = getDb();
  const dayList = lastDays(now);
  const first = dayList[0] ?? istanbulDay(now);
  const [dayRows, countryRows, totalRows] = await Promise.all([
    db.$queryRaw<{ day: string; visits: number; views: number }[]>`
      SELECT "day"::text AS day, COUNT(*)::int AS visits, SUM("views")::int AS views
      FROM "visit"
      WHERE "day" >= ${first}::date
      GROUP BY "day"`,
    db.$queryRaw<{ country: string | null; visits: number; views: number }[]>`
      SELECT "country", COUNT(DISTINCT "address")::int AS visits, SUM("views")::int AS views
      FROM "visit"
      WHERE "day" >= ${first}::date
      GROUP BY "country"
      ORDER BY views DESC, visits DESC, "country" ASC NULLS LAST`,
    db.$queryRaw<{ visits: number; views: number }[]>`
      SELECT COUNT(DISTINCT "address")::int AS visits, COALESCE(SUM("views"), 0)::int AS views
      FROM "visit"
      WHERE "day" >= ${first}::date`,
  ]);
  const byDay = new Map(dayRows.map((row) => [row.day, row]));
  return {
    days: dayList.map((day) => ({ day, visits: byDay.get(day)?.visits ?? 0, views: byDay.get(day)?.views ?? 0 })),
    countries: countryRows,
    totals: totalRows[0] ?? { visits: 0, views: 0 },
  };
}
