import { describe, expect, it } from 'vitest';
import { testDatabaseName } from './integration-env.ts';

describe('testDatabaseName', () => {
  it('is deterministic for a path', () => {
    expect(testDatabaseName('/work/tanyeri')).toBe(testDatabaseName('/work/tanyeri'));
  });

  it('differs between two checkouts', () => {
    expect(testDatabaseName('/work/tanyeri')).not.toBe(testDatabaseName('/work/tanyeri-second'));
  });

  it('is a lowercase Postgres identifier even for awkward paths', () => {
    const name = testDatabaseName('C:\\Users\\Ünlü Kişi\\Desktop\\tanyeri lighting; drop table x');
    expect(name).toMatch(/^tanyeri_test_[0-9a-f]{8}$/);
  });
});
