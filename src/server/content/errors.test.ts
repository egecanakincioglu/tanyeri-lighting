// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { Prisma } from '../../generated/prisma/client.ts';
import { isRecordNotFound, mapUniqueViolation, ValueTakenError } from './errors.ts';

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('failed', { code, clientVersion: 'test', meta });
}

// The shape the Postgres driver adapter reports: the violated index is in the cause of the adapter error.
function adapterError(index: string) {
  return prismaError('P2002', {
    driverAdapterError: { cause: { kind: 'UniqueConstraintViolation', constraint: { index } } },
  });
}

describe('mapUniqueViolation', () => {
  it.each([
    ['product_slug_key', 'slug'],
    ['product_code_key', 'code'],
    ['category_key_key', 'key'],
    ['productSlugRedirect_oldSlug_key', 'slug'],
  ])('maps the index %s to the field %s', (index, field) => {
    const mapped = mapUniqueViolation(adapterError(index));
    expect(mapped).toBeInstanceOf(ValueTakenError);
    expect(mapped).toMatchObject({ field });
  });

  it('maps the constraint fields of the adapter error', () => {
    const error = prismaError('P2002', {
      driverAdapterError: { cause: { constraint: { fields: ['code'] } } },
    });
    expect(mapUniqueViolation(error)).toMatchObject({ field: 'code' });
  });

  it.each([
    ['a list of columns', ['slug'], 'slug'],
    ['a column name', 'code', 'code'],
    ['an index name', 'category_key_key', 'key'],
  ])('maps the target given as %s', (_, target, field) => {
    expect(mapUniqueViolation(prismaError('P2002', { target }))).toMatchObject({ field });
  });

  it.each([
    ['no meta', undefined],
    ['an unknown index', { driverAdapterError: { cause: { constraint: { index: 'user_email_key' } } } }],
    ['an unrelated column', { target: ['monkey'] }],
    ['no constraint', { driverAdapterError: { cause: {} } }],
  ])('falls back to the generic field for %s', (_, meta) => {
    const mapped = mapUniqueViolation(prismaError('P2002', meta));
    expect(mapped).toBeInstanceOf(ValueTakenError);
    expect(mapped).toMatchObject({ field: 'value' });
  });

  it('returns every other error unchanged', () => {
    const notFound = prismaError('P2025');
    const plain = new Error('boom');
    expect(mapUniqueViolation(notFound)).toBe(notFound);
    expect(mapUniqueViolation(plain)).toBe(plain);
    expect(mapUniqueViolation('text')).toBe('text');
  });
});

describe('isRecordNotFound', () => {
  it('is true only for the missing-record code', () => {
    expect(isRecordNotFound(prismaError('P2025'))).toBe(true);
    expect(isRecordNotFound(prismaError('P2002'))).toBe(false);
    expect(isRecordNotFound(new Error('x'))).toBe(false);
  });
});
