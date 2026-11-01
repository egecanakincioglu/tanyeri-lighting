import type { routing } from '../../i18n/routing.ts';
import { getProductBySlug } from '../content/products.ts';

// The product a visitor asks about, from the `product` value of the contact address. The value is only used to look the
// product up; what the page shows comes from the stored product. An unknown value, an old address that now redirects
// and anything that is not a single text give nothing.
export async function findEnquiryProduct(
  value: string | string[] | undefined,
  locale: (typeof routing.locales)[number],
): Promise<{ name: string; code: string } | null> {
  if (typeof value !== 'string' || value === '') return null;
  const found = await getProductBySlug(value);
  if (!found || !('product' in found)) return null;
  return { name: found.product.name[locale], code: found.product.code };
}
