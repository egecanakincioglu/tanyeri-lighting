import { afterAll, describe, expect, it } from 'vitest';
import { getDb } from './db.ts';

describe('getDb', () => {
  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('runs a parameterised query on the real database', async () => {
    const value = 41;
    const rows = await getDb().$queryRaw<{ answer: number }[]>`select ${value}::int + 1 as answer`;
    expect(rows).toEqual([{ answer: 42 }]);
  });

  it('returns the same client on every call', () => {
    expect(getDb()).toBe(getDb());
  });
});
