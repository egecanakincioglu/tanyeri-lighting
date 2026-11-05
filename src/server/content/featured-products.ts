import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { ContentNotFoundError, isForeignKeyViolation } from './errors.ts';
import { productFromRow, withCategory } from './products.ts';
import { featuredProductIdsSchema, type Product } from './schemas.ts';

export async function listFeaturedProducts(): Promise<Product[]> {
  const rows = await getDb().featuredProduct.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { product: { include: withCategory } },
  });
  return rows.map((row) => productFromRow(row.product));
}

// A missing product raises ContentNotFoundError (the foreign key is the check) and the old list stays.
export async function setFeaturedProducts(ids: unknown): Promise<void> {
  assertWritable();
  const productIds = featuredProductIdsSchema.parse(ids);
  try {
    await getDb().$transaction(async (tx) => {
      await tx.featuredProduct.deleteMany();
      await tx.featuredProduct.createMany({
        data: productIds.map((productId, sortOrder) => ({ productId, sortOrder })),
      });
    });
  } catch (error) {
    if (isForeignKeyViolation(error)) throw new ContentNotFoundError('Product');
    throw error;
  }
}
