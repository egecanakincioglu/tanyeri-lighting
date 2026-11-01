// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bilingual, fromColumns, toColumns } from './bilingual.ts';

describe('bilingual', () => {
  const schema = bilingual(10);

  it('accepts a pair and trims both values', () => {
    expect(schema.parse({ tr: '  Merhaba ', en: ' Hello  ' })).toEqual({ tr: 'Merhaba', en: 'Hello' });
  });

  it.each([
    ['the Turkish value', { en: 'Hello' }],
    ['the English value', { tr: 'Merhaba' }],
    ['both values', {}],
  ])('rejects a pair without %s', (_, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it.each([
    ['empty', ''],
    ['only whitespace', '   '],
  ])('rejects a language that is %s, even when the other one is filled in', (_, empty) => {
    expect(schema.safeParse({ tr: empty, en: 'Hello' }).success).toBe(false);
    expect(schema.safeParse({ tr: 'Merhaba', en: empty }).success).toBe(false);
  });

  it('never copies one language into the other', () => {
    expect(schema.safeParse({ tr: 'Merhaba', en: undefined }).success).toBe(false);
    expect(schema.safeParse({ tr: undefined, en: 'Hello' }).success).toBe(false);
  });

  it('enforces the length limit on each language after trimming', () => {
    expect(schema.safeParse({ tr: 'a'.repeat(10), en: ` ${'b'.repeat(10)} ` }).success).toBe(true);
    expect(schema.safeParse({ tr: 'a'.repeat(11), en: 'b' }).success).toBe(false);
    expect(schema.safeParse({ tr: 'a', en: 'b'.repeat(11) }).success).toBe(false);
  });

  it('rejects values that are not text', () => {
    expect(schema.safeParse({ tr: 1, en: 'Hello' }).success).toBe(false);
    expect(schema.safeParse(null).success).toBe(false);
  });
});

describe('column mapping', () => {
  it('maps a pair to the two columns of a field and back', () => {
    const columns = toColumns('siteName', { tr: 'Tanyeri', en: 'Tanyeri Lighting' });
    expect(columns).toEqual({ siteNameTr: 'Tanyeri', siteNameEn: 'Tanyeri Lighting' });
    const row = { ...columns, id: 'other column' };
    expect(fromColumns('siteName', row)).toEqual({ tr: 'Tanyeri', en: 'Tanyeri Lighting' });
  });
});
