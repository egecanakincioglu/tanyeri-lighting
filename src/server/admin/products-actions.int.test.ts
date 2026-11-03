import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCategory } from '../content/categories.ts';
import { listProducts } from '../content/products.ts';
import { getDb } from '../db.ts';
import {
  createProductAction,
  deleteProductAction,
  reorderProductsAction,
  updateProductAction,
} from './products-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), refresh: vi.fn() }));

vi.mock('../auth/guard.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/guard.ts')>()),
  guardAction: mocks.guardAction,
}));
vi.mock('next/cache', () => ({ refresh: mocks.refresh }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

let categoryId = '';

const valid = (slug: string, extra: Record<string, string> = {}) => ({
  categoryId,
  slug,
  code: slug.toUpperCase(),
  'name.tr': `${slug} adı`,
  'name.en': `${slug} name`,
  'color.tr': 'Beyaz',
  'color.en': 'White',
  'material.tr': 'Metal',
  'material.en': 'Metal',
  power: '10 W',
  dimensions: '10 x 10 cm',
  imageUrl: '/demo/area-otel.webp',
  ...extra,
});

async function slugs(): Promise<string[]> {
  return (await listProducts()).map((item) => item.slug);
}

describe('product actions on a real database', () => {
  beforeEach(async () => {
    await getDb().featuredProduct.deleteMany();
    await getDb().product.deleteMany();
    await getDb().category.deleteMany();
    categoryId = (await createCategory({ key: 'indoor', name: { tr: 'İç mekan', en: 'Indoor' } })).id;
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

  it('creates a product and sends the browser to the list of the language', async () => {
    await expect(createProductAction(null, form(valid('alpha', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/products',
    );
    await expect(createProductAction(null, form(valid('beta', { locale: 'tr' })))).rejects.toThrow(
      'redirect:/tr/yonetim/urunler',
    );
    expect(await slugs()).toEqual(['alpha', 'beta']);
  });

  it('saves the description and the technical values from the form', async () => {
    const details = {
      'description.tr': 'Kısa açıklama.',
      'description.en': 'Short description.',
      luminousFlux: '1050 lm',
      colorTemperature: '3000 K',
      cri: 'Ra 90',
      ip: 'IP20',
    };
    await expect(createProductAction(null, form(valid('alpha', details)))).rejects.toThrow('redirect:');
    expect((await listProducts())[0]).toMatchObject({
      description: { tr: 'Kısa açıklama.', en: 'Short description.' },
      luminousFlux: '1050 lm',
      colorTemperature: '3000 K',
      cri: 'Ra 90',
      ip: 'IP20',
    });
  });

  it('refuses a description in one language only', async () => {
    expect(await createProductAction(null, form(valid('alpha', { 'description.tr': 'Yalnız Türkçe.' })))).toMatchObject(
      { status: 'error' },
    );
    expect(await slugs()).toEqual([]);
  });

  it('reports the invalid fields and writes nothing', async () => {
    const result = await createProductAction(null, form(valid('Not Kebab', { power: '', 'name.tr': 'x'.repeat(121) })));
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: {
        slug: { code: 'invalid' },
        'name.tr': { code: 'tooLong', max: 120 },
        power: { code: 'required' },
      },
    });
    expect(await slugs()).toEqual([]);
  });

  it('marks the slug and the code field when they are taken', async () => {
    await expect(createProductAction(null, form(valid('alpha')))).rejects.toThrow('redirect:');
    expect(await createProductAction(null, form(valid('alpha', { code: 'OTHER' })))).toEqual({
      status: 'error',
      code: 'taken',
      fieldErrors: { slug: { code: 'taken' } },
    });
    expect(await createProductAction(null, form(valid('gamma', { code: 'ALPHA' })))).toEqual({
      status: 'error',
      code: 'taken',
      fieldErrors: { code: { code: 'taken' } },
    });
    expect(await slugs()).toEqual(['alpha']);
  });

  it('updates a product, keeps the old address as a redirect, and redraws the screen', async () => {
    await expect(createProductAction(null, form(valid('alpha')))).rejects.toThrow('redirect:');
    const [item] = await listProducts();
    expect(await updateProductAction(null, form(valid('alpha-2', { id: item!.id })))).toEqual({ status: 'success' });
    expect(await slugs()).toEqual(['alpha-2']);
    expect(await getDb().productSlugRedirect.count({ where: { oldSlug: 'alpha', productId: item!.id } })).toBe(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('says not found for a product that no longer exists', async () => {
    expect(await updateProductAction(null, form(valid('alpha', { id: 'missing' })))).toMatchObject({
      code: 'notFound',
    });
    expect(await deleteProductAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
  });

  it('deletes a product, which also leaves the featured list', async () => {
    await expect(createProductAction(null, form(valid('alpha')))).rejects.toThrow('redirect:');
    const [item] = await listProducts();
    await getDb().featuredProduct.create({ data: { productId: item!.id, sortOrder: 0 } });
    expect(await deleteProductAction(null, form({ id: item!.id }))).toEqual({ status: 'success' });
    expect(await slugs()).toEqual([]);
    expect(await getDb().featuredProduct.count()).toBe(0);
  });

  it('reorders the products of a category, and refuses an order that is not the complete list', async () => {
    for (const slug of ['a', 'b', 'c']) {
      await expect(createProductAction(null, form(valid(slug)))).rejects.toThrow('redirect:');
    }
    const ids = (await listProducts()).map((item) => item.id);
    expect(await reorderProductsAction(categoryId, [ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await slugs()).toEqual(['c', 'a', 'b']);
    expect(await reorderProductsAction(categoryId, [ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderProductsAction(categoryId, 'nope' as unknown as string[])).toMatchObject({
      code: 'invalidOrder',
    });
    expect(await reorderProductsAction(7 as unknown as string, ids)).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderProductsAction('missing', ids)).toMatchObject({ code: 'notFound' });
  });

  describe('without a session', () => {
    beforeEach(async () => {
      await expect(createProductAction(null, form(valid('alpha')))).rejects.toThrow('redirect:');
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    });

    it('refuses every action and changes nothing', async () => {
      const [item] = await listProducts();
      const results = [
        await createProductAction(null, form(valid('beta'))),
        await updateProductAction(null, form(valid('changed', { id: item!.id }))),
        await deleteProductAction(null, form({ id: item!.id })),
        await reorderProductsAction(categoryId, [item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await slugs()).toEqual(['alpha']);
    });
  });

  describe('in demo mode', () => {
    beforeEach(async () => {
      await expect(createProductAction(null, form(valid('alpha')))).rejects.toThrow('redirect:');
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('reads everything and writes nothing', async () => {
      const [item] = await listProducts();
      const results = [
        await createProductAction(null, form(valid('beta'))),
        await updateProductAction(null, form(valid('changed', { id: item!.id }))),
        await deleteProductAction(null, form({ id: item!.id })),
        await reorderProductsAction(categoryId, [item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await slugs()).toEqual(['alpha']);
    });
  });
});
