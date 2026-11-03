import type { Service as ServiceRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, isRecordNotFound } from './errors.ts';
import { assertCompleteOrder, nextPosition } from './order.ts';
import { idListSchema, idSchema, type Service, serviceSchema, type ServiceInput } from './schemas.ts';

function fromRow(row: ServiceRow): Service {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    imageAlt: fromColumns('imageAlt', row),
    title: fromColumns('title', row),
    description: fromColumns('description', row),
    note: fromColumns('note', row),
  };
}

function toColumnsOf(service: ServiceInput) {
  return {
    imageUrl: service.imageUrl,
    ...toColumns('imageAlt', service.imageAlt),
    ...toColumns('title', service.title),
    ...toColumns('description', service.description),
    ...toColumns('note', service.note),
  };
}

// The description is Markdown; render it with src/components/markdown-content.tsx, never as raw HTML. A service
// without a note has an empty pair in `note`.
export async function listServices(): Promise<Service[]> {
  const rows = await getDb().service.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.map(fromRow);
}

// The new service goes to the end of the list.
export async function createService(input: unknown): Promise<Service> {
  assertWritable();
  const columns = toColumnsOf(serviceSchema.parse(input));
  const row = await getDb().$transaction(async (tx) => {
    const last = await tx.service.aggregate({ _max: { sortOrder: true } });
    return tx.service.create({ data: { ...columns, sortOrder: nextPosition(last._max.sortOrder) } });
  });
  return fromRow(row);
}

export async function updateService(id: unknown, input: unknown): Promise<Service> {
  assertWritable();
  const serviceId = idSchema.parse(id);
  const columns = toColumnsOf(serviceSchema.parse(input));
  try {
    return fromRow(await getDb().service.update({ where: { id: serviceId }, data: columns }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Service');
    throw error;
  }
}

export async function deleteService(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().service.deleteMany({ where: { id: idSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Service');
}

// `ids` is the complete list in its new order; a missing, extra or repeated id changes nothing.
export async function reorderServices(ids: unknown): Promise<void> {
  assertWritable();
  const order = idListSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    assertCompleteOrder(
      order,
      (await tx.service.findMany({ select: { id: true } })).map((service) => service.id),
    );
    for (const [sortOrder, id] of order.entries()) {
      await tx.service.update({ where: { id }, data: { sortOrder } });
    }
  });
}
