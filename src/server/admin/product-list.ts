import type { Product } from '../content/schemas.ts';

export const PRODUCTS_PER_PAGE = 24;

export type ProductQuery = { q: string; category: string; page: number };

type RawQuery = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** Malformed values fall back to no search, all categories and the first page. */
export function parseProductQuery(raw: RawQuery, categoryKeys: readonly string[]): ProductQuery {
  const category = first(raw['category']);
  const page = Number(first(raw['page']));
  return {
    q: first(raw['q']).trim().slice(0, 100),
    category: categoryKeys.includes(category) ? category : '',
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
  };
}

export function searchProducts(products: Product[], q: string): Product[] {
  const needle = q.toLocaleLowerCase('tr');
  if (needle === '') return products;
  return products.filter((product) =>
    [product.name.tr, product.name.en, product.code].some((text) => text.toLocaleLowerCase('tr').includes(needle)),
  );
}

export function paginate<T>(items: T[], page: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / PRODUCTS_PER_PAGE));
  const current = Math.min(page, pages);
  return { items: items.slice((current - 1) * PRODUCTS_PER_PAGE, current * PRODUCTS_PER_PAGE), page: current, pages };
}
