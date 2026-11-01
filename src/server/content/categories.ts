import type { Category as CategoryRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import {
  CategoryLimitError,
  CategoryNotEmptyError,
  ContentNotFoundError,
  isRecordNotFound,
  mapUniqueViolation,
  ValueTakenError,
} from './errors.ts';
import { assertCompleteOrder, nextPosition } from './order.ts';
import {
  type Category,
  categorySchema,
  type CategoryInput,
  idListSchema,
  idSchema,
  MAX_CATEGORIES,
} from './schemas.ts';

function fromRow(row: CategoryRow): Category {
  return { id: row.id, key: row.key, name: fromColumns('name', row) };
}

function toColumnsOf(category: CategoryInput) {
  return { key: category.key, ...toColumns('name', category.name) };
}

export async function listCategories(): Promise<Category[]> {
  const rows = await getDb().category.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.map(fromRow);
}

// The new category goes to the end of the list. At most MAX_CATEGORIES exist.
export async function createCategory(input: unknown): Promise<Category> {
  assertWritable();
  const columns = toColumnsOf(categorySchema.parse(input));
  try {
    const row = await getDb().$transaction(async (tx) => {
      const { _count, _max } = await tx.category.aggregate({ _count: true, _max: { sortOrder: true } });
      if (_count >= MAX_CATEGORIES) throw new CategoryLimitError(MAX_CATEGORIES);
      if (await tx.category.findUnique({ where: { key: columns.key }, select: { id: true } })) {
        throw new ValueTakenError('key');
      }
      return tx.category.create({ data: { ...columns, sortOrder: nextPosition(_max.sortOrder) } });
    });
    return fromRow(row);
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

export async function updateCategory(id: unknown, input: unknown): Promise<Category> {
  assertWritable();
  const categoryId = idSchema.parse(id);
  const columns = toColumnsOf(categorySchema.parse(input));
  try {
    const row = await getDb().$transaction(async (tx) => {
      const sameKey = await tx.category.findUnique({ where: { key: columns.key }, select: { id: true } });
      if (sameKey && sameKey.id !== categoryId) throw new ValueTakenError('key');
      return tx.category.update({ where: { id: categoryId }, data: columns });
    });
    return fromRow(row);
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Category');
    throw mapUniqueViolation(error);
  }
}

// A category that still has products is not deleted.
export async function deleteCategory(id: unknown): Promise<void> {
  assertWritable();
  const categoryId = idSchema.parse(id);
  await getDb().$transaction(async (tx) => {
    if ((await tx.product.count({ where: { categoryId } })) > 0) throw new CategoryNotEmptyError();
    const result = await tx.category.deleteMany({ where: { id: categoryId } });
    if (result.count === 0) throw new ContentNotFoundError('Category');
  });
}

// `ids` is the complete list in its new order; a missing, extra or repeated id changes nothing.
export async function reorderCategories(ids: unknown): Promise<void> {
  assertWritable();
  const order = idListSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    assertCompleteOrder(
      order,
      (await tx.category.findMany({ select: { id: true } })).map((category) => category.id),
    );
    for (const [sortOrder, id] of order.entries()) {
      await tx.category.update({ where: { id }, data: { sortOrder } });
    }
  });
}
