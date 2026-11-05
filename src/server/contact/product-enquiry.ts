import type { routing } from '../../i18n/routing.ts';
import { getProductBySlug } from '../content/products.ts';

// Looks up the product from the `product` query value.
// An unknown value, an old address that redirects, or anything that is not a single string gives nothing.
export async function findEnquiryProduct(
  value: string | string[] | undefined,
  locale: (typeof routing.locales)[number],
): Promise<{ name: string; code: string } | null> {
  if (typeof value !== 'string' || value === '') return null;
  const found = await getProductBySlug(value);
  if (!found || !('product' in found)) return null;
  return { name: found.product.name[locale], code: found.product.code };
}
