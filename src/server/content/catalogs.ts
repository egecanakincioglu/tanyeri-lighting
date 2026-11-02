import type { Catalog as CatalogRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { CatalogInUseError, ContentNotFoundError, isForeignKeyViolation, isRecordNotFound } from './errors.ts';
import { assertCompleteOrder, nextPosition } from './order.ts';
import { type Catalog, catalogSchema, type CatalogInput, idListSchema, idSchema } from './schemas.ts';

function fromRow(row: CatalogRow): Catalog {
  return {
    id: row.id,
    name: fromColumns('name', row),
    pdfUrl: row.pdfUrl,
    coverImageUrl: row.coverImageUrl,
    sizeBytes: row.sizeBytes,
  };
}

function toColumnsOf(catalog: CatalogInput) {
  return {
    ...toColumns('name', catalog.name),
    pdfUrl: catalog.pdfUrl,
    coverImageUrl: catalog.coverImageUrl,
    sizeBytes: catalog.sizeBytes,
  };
}

export async function listCatalogs(): Promise<Catalog[]> {
  const rows = await getDb().catalog.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.map(fromRow);
}

// The file is uploaded by the storage module; this stores the address and size it returned. The new catalog goes to
// the end of the list.
export async function createCatalog(input: unknown): Promise<Catalog> {
  assertWritable();
  const columns = toColumnsOf(catalogSchema.parse(input));
  const row = await getDb().$transaction(async (tx) => {
    const last = await tx.catalog.aggregate({ _max: { sortOrder: true } });
    return tx.catalog.create({ data: { ...columns, sortOrder: nextPosition(last._max.sortOrder) } });
  });
  return fromRow(row);
}

export async function updateCatalog(id: unknown, input: unknown): Promise<Catalog> {
  assertWritable();
  const catalogId = idSchema.parse(id);
  const columns = toColumnsOf(catalogSchema.parse(input));
  try {
    return fromRow(await getDb().catalog.update({ where: { id: catalogId }, data: columns }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Catalog');
    throw error;
  }
}

// A catalog that a promo board links to is kept: the foreign key refuses the delete, so a board created at the same
// moment cannot slip through a separate check.
export async function deleteCatalog(id: unknown): Promise<void> {
  assertWritable();
  const catalogId = idSchema.parse(id);
  try {
    const result = await getDb().catalog.deleteMany({ where: { id: catalogId } });
    if (result.count === 0) throw new ContentNotFoundError('Catalog');
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new CatalogInUseError();
    throw error;
  }
}

// `ids` is the complete list in its new order; a missing, extra or repeated id changes nothing.
export async function reorderCatalogs(ids: unknown): Promise<void> {
  assertWritable();
  const order = idListSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    assertCompleteOrder(
      order,
      (await tx.catalog.findMany({ select: { id: true } })).map((catalog) => catalog.id),
    );
    for (const [sortOrder, id] of order.entries()) {
      await tx.catalog.update({ where: { id }, data: { sortOrder } });
    }
  });
}
