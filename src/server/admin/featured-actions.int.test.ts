import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { createCategory } from '../content/categories.ts';
import { listFeaturedProducts } from '../content/featured-products.ts';
import { createProduct } from '../content/products.ts';
import { saveFeaturedProductsAction } from './featured-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), refresh: vi.fn() }));

vi.mock('../auth/guard.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/guard.ts')>()),
  guardAction: mocks.guardAction,
}));
vi.mock('next/cache', () => ({ refresh: mocks.refresh }));

const pair = (tr: string, en: string) => ({ tr, en });

async function slugs(): Promise<string[]> {
  return (await listFeaturedProducts()).map((item) => item.slug);
}

describe('featured products action on a real database', () => {
  let ids: string[] = [];

  beforeEach(async () => {
    await getDb().featuredProduct.deleteMany();
    await getDb().product.deleteMany();
    await getDb().category.deleteMany();
    const category = await createCategory({ key: 'indoor', name: pair('İç mekan', 'Indoor') });
    ids = [];
    for (const slug of ['a-1', 'b-2', 'c-3', 'd-4', 'e-5', 'f-6', 'g-7']) {
      const product = await createProduct({
        categoryId: category.id,
        slug,
        code: slug.toUpperCase(),
        name: pair(`${slug} TR`, `${slug} EN`),
        color: pair('Mat siyah', 'Matte black'),
        material: pair('Alüminyum', 'Aluminium'),
        power: '12 W',
        dimensions: 'Ø 120 × 85 mm',
        imageUrl: `https://store.example.com/${slug}.webp`,
      });
      ids.push(product.id);
    }
    mocks.guardAction.mockClear();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('replaces the list with the given order, and clears it with an empty one', async () => {
    expect(await saveFeaturedProductsAction([ids[2]!, ids[0]!])).toEqual({ status: 'success' });
    expect(await slugs()).toEqual(['c-3', 'a-1']);
    expect(await saveFeaturedProductsAction([])).toEqual({ status: 'success' });
    expect(await slugs()).toEqual([]);
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it('refuses a seventh product, a repeated one, an unknown one and a non-list, and keeps the old list', async () => {
    await saveFeaturedProductsAction([ids[0]!]);
    expect(await saveFeaturedProductsAction(ids)).toMatchObject({ status: 'error', code: 'invalid' });
    expect(await saveFeaturedProductsAction([ids[1]!, ids[1]!])).toMatchObject({ code: 'invalid' });
    expect(await saveFeaturedProductsAction(['missing'])).toMatchObject({ code: 'notFound' });
    expect(await saveFeaturedProductsAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
    expect(await slugs()).toEqual(['a-1']);
  });

  it('refuses a visitor without a session and changes nothing', async () => {
    await saveFeaturedProductsAction([ids[0]!]);
    const { UnauthorizedError } = await import('../auth/guard.ts');
    mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    expect(await saveFeaturedProductsAction([ids[1]!])).toMatchObject({ status: 'error', code: 'unauthorized' });
    expect(await slugs()).toEqual(['a-1']);
  });

  it('writes nothing in the demo', async () => {
    await saveFeaturedProductsAction([ids[0]!]);
    vi.stubEnv('DEMO_MODE', 'true');
    expect(await saveFeaturedProductsAction([ids[1]!])).toMatchObject({ status: 'error', code: 'demo' });
    expect(await slugs()).toEqual(['a-1']);
  });
});
