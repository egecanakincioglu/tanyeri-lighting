import type { Reference as ReferenceRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, InvalidOrderError, isRecordNotFound } from './errors.ts';
import {
  type Reference,
  referenceIdSchema,
  referenceOrderSchema,
  referenceSchema,
  type ReferenceInput,
} from './schemas.ts';

function fromRow(row: ReferenceRow): Reference {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    name: row.name,
    title: fromColumns('title', row),
    description: fromColumns('description', row),
  };
}

function toColumnsOf(reference: ReferenceInput) {
  return {
    imageUrl: reference.imageUrl,
    name: reference.name,
    ...toColumns('title', reference.title),
    ...toColumns('description', reference.description),
  };
}

export async function listReferences(): Promise<Reference[]> {
  const rows = await getDb().reference.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.map(fromRow);
}

// The new reference goes to the end of the list.
export async function createReference(input: unknown): Promise<Reference> {
  assertWritable();
  const columns = toColumnsOf(referenceSchema.parse(input));
  const row = await getDb().$transaction(async (tx) => {
    const last = await tx.reference.aggregate({ _max: { sortOrder: true } });
    return tx.reference.create({ data: { ...columns, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
  });
  return fromRow(row);
}

export async function updateReference(id: unknown, input: unknown): Promise<Reference> {
  assertWritable();
  const referenceId = referenceIdSchema.parse(id);
  const columns = toColumnsOf(referenceSchema.parse(input));
  try {
    return fromRow(await getDb().reference.update({ where: { id: referenceId }, data: columns }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Reference');
    throw error;
  }
}

export async function deleteReference(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().reference.deleteMany({ where: { id: referenceIdSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Reference');
}

// `ids` is the complete list in its new order; a missing, extra or repeated id changes nothing.
export async function reorderReferences(ids: unknown): Promise<void> {
  assertWritable();
  const order = referenceOrderSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    const existing = await tx.reference.findMany({ select: { id: true } });
    const known = new Set(existing.map((reference) => reference.id));
    if (order.length !== known.size || new Set(order).size !== order.length || !order.every((id) => known.has(id))) {
      throw new InvalidOrderError();
    }
    for (const [sortOrder, id] of order.entries()) {
      await tx.reference.update({ where: { id }, data: { sortOrder } });
    }
  });
}
