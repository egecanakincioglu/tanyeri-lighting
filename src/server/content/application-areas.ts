import type { ApplicationArea as ApplicationAreaRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, isRecordNotFound } from './errors.ts';
import { assertCompleteOrder, nextPosition } from './order.ts';
import {
  type ApplicationArea,
  applicationAreaSchema,
  type ApplicationAreaInput,
  idListSchema,
  idSchema,
} from './schemas.ts';

function fromRow(row: ApplicationAreaRow): ApplicationArea {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    title: fromColumns('title', row),
    description: fromColumns('description', row),
  };
}

function toColumnsOf(area: ApplicationAreaInput) {
  return {
    imageUrl: area.imageUrl,
    ...toColumns('title', area.title),
    ...toColumns('description', area.description),
  };
}

export async function listApplicationAreas(): Promise<ApplicationArea[]> {
  const rows = await getDb().applicationArea.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.map(fromRow);
}

// The new area goes to the end of the list.
export async function createApplicationArea(input: unknown): Promise<ApplicationArea> {
  assertWritable();
  const columns = toColumnsOf(applicationAreaSchema.parse(input));
  const row = await getDb().$transaction(async (tx) => {
    const last = await tx.applicationArea.aggregate({ _max: { sortOrder: true } });
    return tx.applicationArea.create({ data: { ...columns, sortOrder: nextPosition(last._max.sortOrder) } });
  });
  return fromRow(row);
}

export async function updateApplicationArea(id: unknown, input: unknown): Promise<ApplicationArea> {
  assertWritable();
  const areaId = idSchema.parse(id);
  const columns = toColumnsOf(applicationAreaSchema.parse(input));
  try {
    return fromRow(await getDb().applicationArea.update({ where: { id: areaId }, data: columns }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Application area');
    throw error;
  }
}

export async function deleteApplicationArea(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().applicationArea.deleteMany({ where: { id: idSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Application area');
}

// `ids` is the complete list in its new order; a missing, extra or repeated id changes nothing.
export async function reorderApplicationAreas(ids: unknown): Promise<void> {
  assertWritable();
  const order = idListSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    assertCompleteOrder(
      order,
      (await tx.applicationArea.findMany({ select: { id: true } })).map((area) => area.id),
    );
    for (const [sortOrder, id] of order.entries()) {
      await tx.applicationArea.update({ where: { id }, data: { sortOrder } });
    }
  });
}
