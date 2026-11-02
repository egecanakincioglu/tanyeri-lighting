import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { createCategory } from './categories.ts';
import { ContentNotFoundError, InvalidOrderError, ValueTakenError } from './errors.ts';
import {
  createProduct,
  deleteProduct,
  getProductBySlug,
  listProductChanges,
  listProducts,
  reorderProducts,
  updateProduct,
} from './products.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function product(categoryId: string, slug: string, code = slug.toUpperCase()) {
  return {
    categoryId,
    slug,
    code,
    name: pair(`${slug} TR`, `${slug} EN`),
    color: pair('Mat siyah', 'Matte black'),
    material: pair('Alüminyum', 'Aluminium'),
    power: '12 W',
    dimensions: 'Ø 120 × 85 mm',
    imageUrl: `https://store.example.com/${slug}.webp`,
  };
}

async function slugs(categoryKey?: string): Promise<string[]> {
  return (await listProducts(categoryKey)).map((item) => item.slug);
}

describe('products on a real database', () => {
  let indoor: string;
  let outdoor: string;

  beforeEach(async () => {
    await getDb().product.deleteMany();
    await getDb().category.deleteMany();
    indoor = (await createCategory({ key: 'indoor', name: pair('İç mekan', 'Indoor') })).id;
    outdoor = (await createCategory({ key: 'outdoor', name: pair('Dış mekan', 'Outdoor') })).id;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  describe('create, read, update and delete', () => {
    it('starts with an empty list', async () => {
      expect(await listProducts()).toEqual([]);
    });

    it('creates a product with its category key and no price', async () => {
      const created = await createProduct(product(indoor, 'ring-pendant'));
      expect(created).toEqual({
        id: expect.any(String),
        categoryKey: 'indoor',
        ...product(indoor, 'ring-pendant'),
      });
      expect(Object.keys(created)).not.toContain('price');
      expect(await getDb().product.count()).toBe(1);
    });

    it('lists every product with its address and change time in display order', async () => {
      await createProduct(product(outdoor, 'garden-bollard'));
      const first = await createProduct(product(indoor, 'ring-pendant'));
      const row = await getDb().product.findUniqueOrThrow({ where: { id: first.id } });
      expect(await listProductChanges()).toEqual([
        { slug: 'ring-pendant', updatedAt: row.updatedAt },
        { slug: 'garden-bollard', updatedAt: expect.any(Date) },
      ]);
    });

    it('maps each language to its own column', async () => {
      await createProduct(product(indoor, 'ring-pendant'));
      expect(await getDb().product.findFirstOrThrow()).toMatchObject({
        nameTr: 'ring-pendant TR',
        nameEn: 'ring-pendant EN',
        colorTr: 'Mat siyah',
        colorEn: 'Matte black',
        materialTr: 'Alüminyum',
        materialEn: 'Aluminium',
      });
    });

    it('lists products by category order, then by their own order, and filters by category key', async () => {
      await createProduct(product(outdoor, 'post-light'));
      await createProduct(product(indoor, 'ring-pendant'));
      await createProduct(product(outdoor, 'wall-washer'));
      await createProduct(product(indoor, 'table-lamp'));
      expect(await slugs()).toEqual(['ring-pendant', 'table-lamp', 'post-light', 'wall-washer']);
      expect(await slugs('outdoor')).toEqual(['post-light', 'wall-washer']);
      expect(await slugs('indoor')).toEqual(['ring-pendant', 'table-lamp']);
      expect(await slugs('missing')).toEqual([]);
    });

    it('refuses a missing category', async () => {
      await expect(createProduct(product('missing', 'ring-pendant'))).rejects.toThrow(ContentNotFoundError);
      expect(await listProducts()).toEqual([]);
    });

    it('refuses a code or a slug that another product has, on create and on update', async () => {
      await createProduct(product(indoor, 'ring-pendant', 'RP-1'));
      const other = await createProduct(product(indoor, 'table-lamp', 'TL-1'));
      await expect(createProduct(product(indoor, 'ring-pendant', 'OTHER'))).rejects.toMatchObject({ field: 'slug' });
      await expect(createProduct(product(outdoor, 'post-light', 'RP-1'))).rejects.toMatchObject({ field: 'code' });
      await expect(updateProduct(other.id, product(indoor, 'ring-pendant', 'TL-1'))).rejects.toThrow(ValueTakenError);
      await expect(updateProduct(other.id, product(indoor, 'table-lamp', 'RP-1'))).rejects.toThrow(ValueTakenError);
      expect(await slugs()).toEqual(['ring-pendant', 'table-lamp']);
      expect(await getDb().productSlugRedirect.count()).toBe(0);
    });

    it('updates a product in place and may keep its own code and slug', async () => {
      await createProduct(product(indoor, 'ring-pendant'));
      const second = await createProduct(product(indoor, 'table-lamp'));
      await createProduct(product(indoor, 'floor-lamp'));
      const next = { ...product(indoor, 'table-lamp'), name: pair('Masa lambası', 'Desk lamp'), power: '8 W' };
      expect(await updateProduct(second.id, next)).toEqual({ id: second.id, categoryKey: 'indoor', ...next });
      expect(await slugs()).toEqual(['ring-pendant', 'table-lamp', 'floor-lamp']);
      expect(await getDb().productSlugRedirect.count()).toBe(0);
    });

    it('moves a product to the end of another category', async () => {
      const a = await createProduct(product(indoor, 'ring-pendant'));
      await createProduct(product(indoor, 'table-lamp'));
      await createProduct(product(outdoor, 'post-light'));
      const moved = await updateProduct(a.id, product(outdoor, 'ring-pendant'));
      expect(moved.categoryKey).toBe('outdoor');
      expect(await slugs('outdoor')).toEqual(['post-light', 'ring-pendant']);
      expect(await slugs('indoor')).toEqual(['table-lamp']);
      await expect(updateProduct(a.id, product('missing', 'ring-pendant'))).rejects.toThrow(ContentNotFoundError);
    });

    it('deletes a product and keeps the order of the others', async () => {
      await createProduct(product(indoor, 'ring-pendant'));
      const second = await createProduct(product(indoor, 'table-lamp'));
      await createProduct(product(indoor, 'floor-lamp'));
      await deleteProduct(second.id);
      expect(await slugs('indoor')).toEqual(['ring-pendant', 'floor-lamp']);
      await createProduct(product(indoor, 'desk-lamp'));
      expect(await slugs('indoor')).toEqual(['ring-pendant', 'floor-lamp', 'desk-lamp']);
    });

    it('reports a missing product on update and delete', async () => {
      await expect(updateProduct('missing', product(indoor, 'ring-pendant'))).rejects.toThrow(ContentNotFoundError);
      await expect(deleteProduct('missing')).rejects.toThrow(ContentNotFoundError);
    });

    it('rejects invalid input and stores nothing', async () => {
      await expect(createProduct({ ...product(indoor, 'ring-pendant'), name: { tr: 'Halka' } })).rejects.toThrow();
      await expect(createProduct(product(indoor, 'Ring Pendant'))).rejects.toThrow();
      await expect(
        createProduct({ ...product(indoor, 'ring-pendant'), imageUrl: 'http://x.example.com/a.webp' }),
      ).rejects.toThrow();
      await expect(createProduct({ ...product(indoor, 'ring-pendant'), price: 100 })).rejects.toThrow();
      await expect(deleteProduct('')).rejects.toThrow();
      expect(await listProducts()).toEqual([]);
    });

    it('rejects an invalid update and keeps the stored product', async () => {
      const created = await createProduct(product(indoor, 'ring-pendant'));
      await expect(updateProduct(created.id, { ...product(indoor, 'ring-pendant'), power: '' })).rejects.toThrow();
      await expect(updateProduct(created.id, { ...product(indoor, 'ring-pendant'), price: 5 })).rejects.toThrow();
      expect(await listProducts()).toEqual([created]);
    });
  });

  describe('slug changes and redirects', () => {
    it('answers an old slug with the current one', async () => {
      const created = await createProduct(product(indoor, 'ring-pendant'));
      const updated = await updateProduct(created.id, product(indoor, 'ring-pendant-120'));
      expect(await getProductBySlug('ring-pendant')).toEqual({ redirectTo: 'ring-pendant-120' });
      expect(await getProductBySlug('ring-pendant-120')).toEqual({ product: updated });
    });

    it('returns null for a slug that never existed', async () => {
      expect(await getProductBySlug('nothing-here')).toBeNull();
    });

    it('resolves a chain of changes to the current slug', async () => {
      const created = await createProduct(product(indoor, 'slug-a'));
      await updateProduct(created.id, product(indoor, 'slug-b'));
      await updateProduct(created.id, product(indoor, 'slug-c'));
      await updateProduct(created.id, product(indoor, 'slug-d'));
      for (const old of ['slug-a', 'slug-b', 'slug-c']) {
        expect(await getProductBySlug(old)).toEqual({ redirectTo: 'slug-d' });
      }
      expect(await getDb().productSlugRedirect.count()).toBe(3);
    });

    it('takes the slug back without keeping a redirect to itself', async () => {
      const created = await createProduct(product(indoor, 'slug-a'));
      await updateProduct(created.id, product(indoor, 'slug-b'));
      await updateProduct(created.id, product(indoor, 'slug-a'));
      expect(await getProductBySlug('slug-a')).toMatchObject({ product: { id: created.id, slug: 'slug-a' } });
      expect(await getProductBySlug('slug-b')).toEqual({ redirectTo: 'slug-a' });
      expect(await getDb().productSlugRedirect.findMany({ select: { oldSlug: true } })).toEqual([
        { oldSlug: 'slug-b' },
      ]);
    });

    it('refuses a slug that is an old slug of another product and changes nothing', async () => {
      const first = await createProduct(product(indoor, 'old-name'));
      await updateProduct(first.id, product(indoor, 'new-name'));
      const second = await createProduct(product(indoor, 'table-lamp'));

      await expect(createProduct(product(indoor, 'old-name', 'OTHER'))).rejects.toMatchObject({
        name: 'ValueTakenError',
        field: 'slug',
      });
      await expect(updateProduct(second.id, product(indoor, 'old-name'))).rejects.toThrow(ValueTakenError);

      expect(await getProductBySlug('old-name')).toEqual({ redirectTo: 'new-name' });
      expect(await getProductBySlug('table-lamp')).toMatchObject({ product: { id: second.id } });
      expect(await getDb().productSlugRedirect.count()).toBe(1);
    });

    it('deletes the redirects with the product and then frees the slugs', async () => {
      const created = await createProduct(product(indoor, 'slug-a'));
      await updateProduct(created.id, product(indoor, 'slug-b'));
      await updateProduct(created.id, product(indoor, 'slug-c'));
      await deleteProduct(created.id);
      expect(await getDb().productSlugRedirect.count()).toBe(0);
      expect(await getProductBySlug('slug-a')).toBeNull();
      expect(await getProductBySlug('slug-c')).toBeNull();
      const reused = await createProduct(product(indoor, 'slug-a'));
      expect(await getProductBySlug('slug-a')).toEqual({ product: reused });
    });
  });

  // Two writers pass the in-transaction check at the same time; the unique index decides and the loser gets the same
  // error as a failed check.
  describe('concurrent writers', () => {
    async function settle(...writes: Promise<unknown>[]) {
      const results = await Promise.allSettled(writes);
      const failures = results.flatMap((result) => (result.status === 'rejected' ? [result.reason] : []));
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      return failures;
    }

    it('lets one of two creates with the same slug win', async () => {
      const failures = await settle(
        createProduct(product(indoor, 'ring-pendant', 'A-1')),
        createProduct(product(outdoor, 'ring-pendant', 'B-1')),
      );
      expect(failures[0]).toMatchObject({ name: 'ValueTakenError', field: 'slug' });
      expect(await getDb().product.count()).toBe(1);
    });

    it('lets one of two creates with the same code win', async () => {
      const failures = await settle(
        createProduct(product(indoor, 'ring-pendant', 'SAME')),
        createProduct(product(outdoor, 'post-light', 'SAME')),
      );
      expect(failures[0]).toMatchObject({ name: 'ValueTakenError', field: 'code' });
      expect(await getDb().product.count()).toBe(1);
    });

    it('lets one of two updates to the same slug or code win and keeps a single redirect', async () => {
      const a = await createProduct(product(indoor, 'slug-a', 'A-1'));
      const b = await createProduct(product(indoor, 'slug-b', 'B-1'));
      const slugFailures = await settle(
        updateProduct(a.id, product(indoor, 'shared', 'A-1')),
        updateProduct(b.id, product(indoor, 'shared', 'B-1')),
      );
      expect(slugFailures[0]).toMatchObject({ name: 'ValueTakenError', field: 'slug' });
      expect(await getDb().productSlugRedirect.count()).toBe(1);

      const c = await createProduct(product(indoor, 'slug-c', 'C-1'));
      const d = await createProduct(product(indoor, 'slug-d', 'D-1'));
      const codeFailures = await settle(
        updateProduct(c.id, product(indoor, 'slug-c', 'NEW')),
        updateProduct(d.id, product(indoor, 'slug-d', 'NEW')),
      );
      expect(codeFailures[0]).toMatchObject({ name: 'ValueTakenError', field: 'code' });
    });
  });

  describe('reorder within a category', () => {
    it('reorders one category and leaves the other alone', async () => {
      const a = await createProduct(product(indoor, 'ring-pendant'));
      const b = await createProduct(product(indoor, 'table-lamp'));
      const c = await createProduct(product(indoor, 'floor-lamp'));
      await createProduct(product(outdoor, 'post-light'));
      await createProduct(product(outdoor, 'wall-washer'));
      await reorderProducts(indoor, [c.id, a.id, b.id]);
      expect(await slugs('indoor')).toEqual(['floor-lamp', 'ring-pendant', 'table-lamp']);
      expect(await slugs('outdoor')).toEqual(['post-light', 'wall-washer']);
    });

    it.each([
      ['an id that is left out', (ids: string[]) => ids.slice(1)],
      ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
      ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
      ['an extra id', (ids: string[]) => [...ids, 'extra']],
    ])('rejects a new order with %s and changes nothing', async (_, build) => {
      const a = await createProduct(product(indoor, 'ring-pendant'));
      const b = await createProduct(product(indoor, 'table-lamp'));
      const c = await createProduct(product(indoor, 'floor-lamp'));
      await expect(reorderProducts(indoor, build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
      expect(await slugs('indoor')).toEqual(['ring-pendant', 'table-lamp', 'floor-lamp']);
    });

    it('rejects the id of a product from another category', async () => {
      const a = await createProduct(product(indoor, 'ring-pendant'));
      const b = await createProduct(product(outdoor, 'post-light'));
      await expect(reorderProducts(indoor, [a.id, b.id])).rejects.toThrow(InvalidOrderError);
      await expect(reorderProducts(indoor, [b.id])).rejects.toThrow(InvalidOrderError);
    });

    it('accepts an empty order for an empty category and reports a missing category', async () => {
      await expect(reorderProducts(indoor, [])).resolves.toBeUndefined();
      await expect(reorderProducts('missing', [])).rejects.toThrow(ContentNotFoundError);
      await expect(reorderProducts(indoor, 'not a list')).rejects.toThrow();
      await expect(reorderProducts('', [])).rejects.toThrow();
    });
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createProduct(product(indoor, 'ring-pendant'));
    const b = await createProduct(product(indoor, 'table-lamp'));
    const before = await listProducts();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createProduct(product(indoor, 'floor-lamp'))).rejects.toThrow(DemoModeError);
    await expect(updateProduct(a.id, product(indoor, 'floor-lamp'))).rejects.toThrow(DemoModeError);
    await expect(deleteProduct(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderProducts(indoor, [b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createProduct({})).rejects.toThrow(DemoModeError);
    expect(await listProducts()).toEqual(before);
    expect(await getDb().productSlugRedirect.count()).toBe(0);
  });
});
