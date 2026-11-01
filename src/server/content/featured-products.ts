import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { ContentNotFoundError, isForeignKeyViolation } from './errors.ts';
import { productFromRow, withCategory } from './products.ts';
import { featuredProductIdsSchema, type Product } from './schemas.ts';

// The products of the home page in display order, with their current slug and category key. A product that was
// deleted has left the list.
export async function listFeaturedProducts(): Promise<Product[]> {
  const rows = await getDb().featuredProduct.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { product: { include: withCategory } },
  });
  return rows.map((row) => productFromRow(row.product));
}

// Replaces the whole list with `ids`, in that order; an empty list clears it. An id that appears twice is invalid
// input; an id that is no product raises ContentNotFoundError (the foreign key is the check, so a product deleted at
// the same moment cannot slip through) and the old list stays.
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
