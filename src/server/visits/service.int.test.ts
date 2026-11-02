import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { STATS_DAYS, getVisitStats, lastDays, recordVisit } from './service.ts';

const NOW = new Date('2026-11-02T10:00:00Z');

function row(day: string, overrides: Partial<{ address: string; country: string | null; views: number }> = {}) {
  return {
    day: new Date(day),
    country: overrides.country === undefined ? 'TR' : overrides.country,
    city: null,
    address: overrides.address ?? '203.0.113.0',
    views: overrides.views ?? 1,
  };
}

describe('lastDays', () => {
  it('lists the last 30 calendar days, today included, oldest first', () => {
    const days = lastDays(NOW);
    expect(days).toHaveLength(STATS_DAYS);
    expect(days[0]).toBe('2026-10-04');
    expect(days.at(-1)).toBe('2026-11-02');
  });

  it('follows the Istanbul calendar, not UTC', () => {
    expect(lastDays(new Date('2026-11-01T22:30:00Z'), 2)).toEqual(['2026-11-01', '2026-11-02']);
    expect(lastDays(new Date('2026-11-01T20:30:00Z'), 2)).toEqual(['2026-10-31', '2026-11-01']);
  });
});

describe('visit statistics on a real database', () => {
  beforeEach(async () => {
    await getDb().visit.deleteMany();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('is empty without visits', async () => {
    const stats = await getVisitStats(NOW);
    expect(stats.totals).toEqual({ visits: 0, views: 0 });
    expect(stats.countries).toEqual([]);
    expect(stats.days).toHaveLength(STATS_DAYS);
    expect(stats.days.every((day) => day.visits === 0 && day.views === 0)).toBe(true);
  });

  it('counts a day visit per address row and page views as the sum of views', async () => {
    await getDb().visit.createMany({
      data: [
        row('2026-11-02', { views: 3 }),
        row('2026-11-02', { address: '198.51.100.0', views: 2 }),
        row('2026-11-01', { views: 4 }),
      ],
    });
    const stats = await getVisitStats(NOW);
    expect(stats.days.at(-1)).toEqual({ day: '2026-11-02', visits: 2, views: 5 });
    expect(stats.days.at(-2)).toEqual({ day: '2026-11-01', visits: 1, views: 4 });
    expect(stats.totals).toEqual({ visits: 2, views: 9 });
  });

  it('leaves out days before the 30 day window', async () => {
    await getDb().visit.createMany({ data: [row('2026-10-03'), row('2026-10-04', { address: '198.51.100.0' })] });
    const stats = await getVisitStats(NOW);
    expect(stats.totals).toEqual({ visits: 1, views: 1 });
    expect(stats.days[0]).toEqual({ day: '2026-10-04', visits: 1, views: 1 });
  });

  it('groups by country, most page views first, with unknown as null', async () => {
    await getDb().visit.createMany({
      data: [
        row('2026-11-02', { country: 'DE', address: '198.51.100.0' }),
        row('2026-11-02', { country: 'TR', views: 2 }),
        row('2026-11-01', { country: 'TR', views: 1 }),
        row('2026-11-02', { country: null, address: 'unknown' }),
      ],
    });
    const stats = await getVisitStats(NOW);
    expect(stats.countries).toEqual([
      { country: 'TR', visits: 1, views: 3 },
      { country: 'DE', visits: 1, views: 1 },
      { country: null, visits: 1, views: 1 },
    ]);
  });
});

describe('recordVisit', () => {
  beforeEach(async () => {
    await getDb().visit.deleteMany();
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the given fields for the Istanbul day', async () => {
    vi.setSystemTime(new Date('2026-11-01T22:30:00Z'));
    await recordVisit({ country: 'DE', city: 'Berlin', address: '203.0.113.0' });
    const stored = await getDb().visit.findFirstOrThrow();
    expect(stored).toMatchObject({ country: 'DE', city: 'Berlin', address: '203.0.113.0', views: 1 });
    expect(stored.day.toISOString().slice(0, 10)).toBe('2026-11-02');
  });

  it('makes one row per day and address with a growing count, and a new row the next day', async () => {
    const input = { country: 'TR', city: 'Ankara', address: '203.0.113.0' };
    vi.setSystemTime(new Date('2026-11-02T08:00:00Z'));
    await Promise.all(Array.from({ length: 5 }, () => recordVisit(input)));
    await recordVisit({ ...input, country: 'DE', city: 'Berlin' });
    await recordVisit({ ...input, address: '198.51.100.0' });
    const rows = await getDb().visit.findMany({ orderBy: { address: 'asc' } });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ address: '198.51.100.0', views: 1 });
    expect(rows[1]).toMatchObject({ address: '203.0.113.0', views: 6, country: 'TR', city: 'Ankara' });

    vi.setSystemTime(new Date('2026-11-03T08:00:00Z'));
    await recordVisit(input);
    expect(await getDb().visit.count()).toBe(3);
  });

  it('removes rows older than 13 months, at most once a day', async () => {
    const db = getDb();
    const base = Date.now();
    const monthsAgo = (months: number) => {
      const date = new Date(base);
      date.setUTCMonth(date.getUTCMonth() - months);
      date.setUTCHours(0, 0, 0, 0);
      return date;
    };
    const day = 24 * 60 * 60 * 1000;
    const old = (address: string, months: number) => ({ day: monthsAgo(months), address, views: 1 });
    const left = async () => (await db.visit.findMany({ orderBy: { address: 'asc' } })).map((r) => r.address);
    const fresh = { country: null, city: null, address: 'new' };

    await db.visit.createMany({ data: [old('old-1', 14), old('keep', 12)] });
    vi.setSystemTime(base + 3 * day);
    await recordVisit(fresh);
    expect(await left()).toEqual(['keep', 'new']);

    await db.visit.create({ data: old('old-2', 15) });
    vi.setSystemTime(base + 3 * day + 8 * 60 * 60 * 1000);
    await recordVisit(fresh);
    expect(await left()).toContain('old-2');

    vi.setSystemTime(base + 5 * day);
    await recordVisit(fresh);
    expect(await left()).not.toContain('old-2');
  });
});
