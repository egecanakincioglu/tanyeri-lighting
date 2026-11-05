import type { Prisma } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, mapUniqueViolation, ValueTakenError } from './errors.ts';
import { assertCompleteOrder, nextPosition } from './order.ts';
import { idListSchema, idSchema, KEBAB_CASE, type Product, productSchema, type ProductInput } from './schemas.ts';

export const withCategory = { category: { select: { key: true } } } satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof withCategory }>;

export function productFromRow(row: ProductRow): Product {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryKey: row.category.key,
    slug: row.slug,
    code: row.code,
    name: fromColumns('name', row),
    color: fromColumns('color', row),
    material: fromColumns('material', row),
    power: row.power,
    dimensions: row.dimensions,
    description: fromColumns('description', row),
    luminousFlux: row.luminousFlux,
    colorTemperature: row.colorTemperature,
    cri: row.cri,
    ip: row.ip,
    imageUrl: row.imageUrl,
  };
}

function toColumnsOf(product: ProductInput) {
  return {
    categoryId: product.categoryId,
    slug: product.slug,
    code: product.code,
    ...toColumns('name', product.name),
    ...toColumns('color', product.color),
    ...toColumns('material', product.material),
    power: product.power,
    dimensions: product.dimensions,
    ...toColumns('description', product.description),
    luminousFlux: product.luminousFlux,
    colorTemperature: product.colorTemperature,
    cri: product.cri,
    ip: product.ip,
    imageUrl: product.imageUrl,
  };
}

// A key that matches no category gives an empty list.
export async function listProducts(categoryKey?: string): Promise<Product[]> {
  const rows = await getDb().product.findMany({
    where: categoryKey === undefined ? undefined : { category: { key: categoryKey } },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { id: 'asc' }],
    include: withCategory,
  });
  return rows.map(productFromRow);
}

export async function listProductChanges(): Promise<{ slug: string; updatedAt: Date }[]> {
  return getDb().product.findMany({
    select: { slug: true, updatedAt: true },
    orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { id: 'asc' }],
  });
}

export type ProductLookup = { product: Product } | { redirectTo: string };

// An old slug gives the current slug. A value that cannot be a slug (such as a NUL byte) is unknown, so no query runs.
export async function getProductBySlug(slug: string): Promise<ProductLookup | null> {
  if (!KEBAB_CASE.test(slug)) return null;
  const db = getDb();
  const row = await db.product.findUnique({ where: { slug }, include: withCategory });
  if (row) return { product: productFromRow(row) };
  const redirect = await db.productSlugRedirect.findUnique({
    where: { oldSlug: slug },
    select: { product: { select: { slug: true } } },
  });
  return redirect ? { redirectTo: redirect.product.slug } : null;
}

async function requireCategory(tx: Prisma.TransactionClient, id: string): Promise<void> {
  if (!(await tx.category.findUnique({ where: { id }, select: { id: true } }))) {
    throw new ContentNotFoundError('Category');
  }
}

async function assertCodeFree(tx: Prisma.TransactionClient, code: string, productId?: string): Promise<void> {
  const taken = await tx.product.findUnique({ where: { code }, select: { id: true } });
  if (taken && taken.id !== productId) throw new ValueTakenError('code');
}

// Free if no other product has it or redirects from it. The product's own old slugs are free.
async function assertSlugFree(tx: Prisma.TransactionClient, slug: string, productId?: string): Promise<void> {
  const product = await tx.product.findUnique({ where: { slug }, select: { id: true } });
  const redirect = await tx.productSlugRedirect.findUnique({ where: { oldSlug: slug }, select: { productId: true } });
  if ((product && product.id !== productId) || (redirect && redirect.productId !== productId)) {
    throw new ValueTakenError('slug');
  }
}

async function nextSortOrder(tx: Prisma.TransactionClient, categoryId: string): Promise<number> {
  const last = await tx.product.aggregate({ where: { categoryId }, _max: { sortOrder: true } });
  return nextPosition(last._max.sortOrder);
}

export async function createProduct(input: unknown): Promise<Product> {
  assertWritable();
  const columns = toColumnsOf(productSchema.parse(input));
  try {
    const row = await getDb().$transaction(async (tx) => {
      await requireCategory(tx, columns.categoryId);
      await assertSlugFree(tx, columns.slug);
      await assertCodeFree(tx, columns.code);
      return tx.product.create({
        data: { ...columns, sortOrder: await nextSortOrder(tx, columns.categoryId) },
        include: withCategory,
      });
    });
    return productFromRow(row);
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

// A product that moves to another category goes to its end.
export async function updateProduct(id: unknown, input: unknown): Promise<Product> {
  assertWritable();
  const productId = idSchema.parse(id);
  const columns = toColumnsOf(productSchema.parse(input));
  try {
    const row = await getDb().$transaction(async (tx) => {
      const current = await tx.product.findUnique({
        where: { id: productId },
        select: { slug: true, categoryId: true },
      });
      if (!current) throw new ContentNotFoundError('Product');
      await assertCodeFree(tx, columns.code, productId);
      if (columns.slug !== current.slug) {
        await assertSlugFree(tx, columns.slug, productId);
        await tx.productSlugRedirect.deleteMany({ where: { oldSlug: columns.slug, productId } });
        await tx.productSlugRedirect.create({ data: { oldSlug: current.slug, productId } });
      }
      let sortOrder: number | undefined;
      if (columns.categoryId !== current.categoryId) {
        await requireCategory(tx, columns.categoryId);
        sortOrder = await nextSortOrder(tx, columns.categoryId);
      }
      return tx.product.update({ where: { id: productId }, data: { ...columns, sortOrder }, include: withCategory });
    });
    return productFromRow(row);
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

export async function deleteProduct(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().product.deleteMany({ where: { id: idSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Product');
}

// Anything but the complete list changes nothing.
export async function reorderProducts(categoryId: unknown, ids: unknown): Promise<void> {
  assertWritable();
  const category = idSchema.parse(categoryId);
  const order = idListSchema.parse(ids);
  await getDb().$transaction(async (tx) => {
    await requireCategory(tx, category);
    assertCompleteOrder(
      order,
      (await tx.product.findMany({ where: { categoryId: category }, select: { id: true } })).map(
        (product) => product.id,
      ),
    );
    for (const [sortOrder, id] of order.entries()) {
      await tx.product.update({ where: { id }, data: { sortOrder } });
    }
  });
}
