import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { createCategory } from './categories.ts';
import { ContentNotFoundError } from './errors.ts';
import { listFeaturedProducts, setFeaturedProducts } from './featured-products.ts';
import { createProduct, deleteProduct, updateProduct } from './products.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function product(categoryId: string, slug: string) {
  return {
    categoryId,
    slug,
    code: slug.toUpperCase(),
    name: pair(`${slug} TR`, `${slug} EN`),
    color: pair('Mat siyah', 'Matte black'),
    material: pair('Alüminyum', 'Aluminium'),
    power: '12 W',
    dimensions: 'Ø 120 × 85 mm',
    description: pair('', ''),
    luminousFlux: '',
    colorTemperature: '',
    cri: '',
    ip: '',
    imageUrl: `https://store.example.com/${slug}.webp`,
  };
}

async function slugs(): Promise<string[]> {
  return (await listFeaturedProducts()).map((item) => item.slug);
}

describe('featured products on a real database', () => {
  let indoor: string;
  let outdoor: string;
  let ring: string;
  let spot: string;
  let lamp: string;

  beforeEach(async () => {
    await getDb().featuredProduct.deleteMany();
    await getDb().product.deleteMany();
    await getDb().category.deleteMany();
    indoor = (await createCategory({ key: 'indoor', name: pair('İç mekan', 'Indoor') })).id;
    outdoor = (await createCategory({ key: 'outdoor', name: pair('Dış mekan', 'Outdoor') })).id;
    ring = (await createProduct(product(indoor, 'ring-pendant'))).id;
    spot = (await createProduct(product(indoor, 'track-spot'))).id;
    lamp = (await createProduct(product(outdoor, 'garden-lamp'))).id;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listFeaturedProducts()).toEqual([]);
  });

  it('lists the products in the order they were set, with their slug and category key', async () => {
    await setFeaturedProducts([lamp, ring, spot]);
    const list = await listFeaturedProducts();
    expect(list.map((item) => item.id)).toEqual([lamp, ring, spot]);
    expect(list[0]).toEqual({ id: lamp, categoryKey: 'outdoor', ...product(outdoor, 'garden-lamp') });
    expect(list[1]?.categoryKey).toBe('indoor');
  });

  it('replaces the whole list and takes the order of the new one', async () => {
    await setFeaturedProducts([ring, spot]);
    await setFeaturedProducts([lamp, spot]);
    expect(await slugs()).toEqual(['garden-lamp', 'track-spot']);
    expect(await getDb().featuredProduct.count()).toBe(2);
    await setFeaturedProducts([spot, lamp]);
    expect(await slugs()).toEqual(['track-spot', 'garden-lamp']);
  });

  it('clears the list with an empty one and leaves the products alone', async () => {
    await setFeaturedProducts([ring, spot]);
    await setFeaturedProducts([]);
    expect(await listFeaturedProducts()).toEqual([]);
    expect(await getDb().product.count()).toBe(3);
  });

  it('rejects a repeated id and keeps the old list', async () => {
    await setFeaturedProducts([ring, spot]);
    await expect(setFeaturedProducts([lamp, lamp])).rejects.toThrow();
    expect(await slugs()).toEqual(['ring-pendant', 'track-spot']);
  });

  it('rejects an unknown id with ContentNotFoundError and keeps the old list', async () => {
    await setFeaturedProducts([ring, spot]);
    await expect(setFeaturedProducts([lamp, 'missing'])).rejects.toThrow(ContentNotFoundError);
    expect(await slugs()).toEqual(['ring-pendant', 'track-spot']);
    await expect(setFeaturedProducts(['missing'])).rejects.toThrow(ContentNotFoundError);
    expect(await slugs()).toEqual(['ring-pendant', 'track-spot']);
  });

  it('rejects input that is no list of ids', async () => {
    await setFeaturedProducts([ring]);
    await expect(setFeaturedProducts('not a list')).rejects.toThrow();
    await expect(setFeaturedProducts([ring, ''])).rejects.toThrow();
    await expect(setFeaturedProducts([1])).rejects.toThrow();
    await expect(setFeaturedProducts(undefined)).rejects.toThrow();
    expect(await slugs()).toEqual(['ring-pendant']);
  });

  it('drops a deleted product out of the list and keeps the order of the others', async () => {
    await setFeaturedProducts([ring, lamp, spot]);
    await deleteProduct(lamp);
    expect(await slugs()).toEqual(['ring-pendant', 'track-spot']);
    expect(await getDb().featuredProduct.count()).toBe(2);
  });

  it('shows the current slug after a product changes its slug or category', async () => {
    await setFeaturedProducts([ring, spot]);
    await updateProduct(ring, { ...product(outdoor, 'ring-pendant-v2'), code: 'RING-PENDANT' });
    const list = await listFeaturedProducts();
    expect(list.map((item) => [item.slug, item.categoryKey])).toEqual([
      ['ring-pendant-v2', 'outdoor'],
      ['track-spot', 'indoor'],
    ]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    await setFeaturedProducts([ring, spot]);
    const before = await listFeaturedProducts();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(setFeaturedProducts([lamp])).rejects.toThrow(DemoModeError);
    await expect(setFeaturedProducts([])).rejects.toThrow(DemoModeError);
    await expect(setFeaturedProducts('invalid')).rejects.toThrow(DemoModeError);
    expect(await listFeaturedProducts()).toEqual(before);
  });
});
