import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listCategories } from '../content/categories.ts';
import { getDb } from '../db.ts';
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from './categories-actions.ts';

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

const valid = (key: string, extra: Record<string, string> = {}) => ({
  key,
  'name.tr': `${key} adı`,
  'name.en': `${key} name`,
  ...extra,
});

async function keys(): Promise<string[]> {
  return (await listCategories()).map((item) => item.key);
}

describe('category actions on a real database', () => {
  beforeEach(async () => {
    await getDb().product.deleteMany();
    await getDb().category.deleteMany();
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

  it('creates a category and sends the browser to the list of the language', async () => {
    await expect(createCategoryAction(null, form(valid('indoor', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/categories',
    );
    await expect(createCategoryAction(null, form(valid('outdoor', { locale: 'tr' })))).rejects.toThrow(
      'redirect:/tr/yonetim/kategoriler',
    );
    expect(await keys()).toEqual(['indoor', 'outdoor']);
  });

  it('reports the invalid fields and writes nothing', async () => {
    const result = await createCategoryAction(null, form(valid('Not Kebab', { 'name.en': '' })));
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: { key: { code: 'invalid' }, 'name.en': { code: 'required' } },
    });
    expect(await keys()).toEqual([]);
  });

  it('marks the key field when the key is taken', async () => {
    await expect(createCategoryAction(null, form(valid('indoor')))).rejects.toThrow('redirect:');
    expect(await createCategoryAction(null, form(valid('indoor')))).toEqual({
      status: 'error',
      code: 'taken',
      fieldErrors: { key: { code: 'taken' } },
    });
  });

  it('refuses a ninth category with its own message', async () => {
    for (let index = 1; index <= 8; index += 1) {
      await expect(createCategoryAction(null, form(valid(`group-${index}`)))).rejects.toThrow('redirect:');
    }
    expect(await createCategoryAction(null, form(valid('group-9')))).toMatchObject({
      status: 'error',
      code: 'categoryLimit',
    });
    expect(await keys()).toHaveLength(8);
  });

  it('updates a category and redraws the screen', async () => {
    await expect(createCategoryAction(null, form(valid('indoor')))).rejects.toThrow('redirect:');
    const [item] = await listCategories();
    expect(await updateCategoryAction(null, form(valid('inside', { id: item!.id })))).toEqual({ status: 'success' });
    expect(await keys()).toEqual(['inside']);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('says not found for a category that no longer exists', async () => {
    expect(await updateCategoryAction(null, form(valid('indoor', { id: 'missing' })))).toMatchObject({
      code: 'notFound',
    });
    expect(await deleteCategoryAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
  });

  it('deletes an empty category and refuses one that still has products', async () => {
    await expect(createCategoryAction(null, form(valid('indoor')))).rejects.toThrow('redirect:');
    await expect(createCategoryAction(null, form(valid('outdoor')))).rejects.toThrow('redirect:');
    const [indoor, outdoor] = await listCategories();
    await getDb().product.create({
      data: {
        categoryId: indoor!.id,
        slug: 'lamp',
        code: 'L-1',
        nameTr: 'Lamba',
        nameEn: 'Lamp',
        colorTr: 'Beyaz',
        colorEn: 'White',
        materialTr: 'Metal',
        materialEn: 'Metal',
        power: '10 W',
        dimensions: '10 cm',
        imageUrl: '/demo/area-otel.webp',
        sortOrder: 0,
      },
    });
    expect(await deleteCategoryAction(null, form({ id: indoor!.id }))).toMatchObject({
      status: 'error',
      code: 'categoryNotEmpty',
    });
    expect(await deleteCategoryAction(null, form({ id: outdoor!.id }))).toEqual({ status: 'success' });
    expect(await keys()).toEqual(['indoor']);
  });

  it('reorders the list, and refuses an order that is not the complete list', async () => {
    for (const key of ['a', 'b', 'c']) {
      await expect(createCategoryAction(null, form(valid(key)))).rejects.toThrow('redirect:');
    }
    const ids = (await listCategories()).map((item) => item.id);
    expect(await reorderCategoriesAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await keys()).toEqual(['c', 'a', 'b']);
    expect(await reorderCategoriesAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderCategoriesAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
  });

  describe('without a session', () => {
    beforeEach(async () => {
      await expect(createCategoryAction(null, form(valid('indoor')))).rejects.toThrow('redirect:');
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    });

    it('refuses every action and changes nothing', async () => {
      const [item] = await listCategories();
      const results = [
        await createCategoryAction(null, form(valid('outdoor'))),
        await updateCategoryAction(null, form(valid('changed', { id: item!.id }))),
        await deleteCategoryAction(null, form({ id: item!.id })),
        await reorderCategoriesAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await keys()).toEqual(['indoor']);
    });
  });

  describe('in demo mode', () => {
    beforeEach(async () => {
      await expect(createCategoryAction(null, form(valid('indoor')))).rejects.toThrow('redirect:');
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('reads everything and writes nothing', async () => {
      const [item] = await listCategories();
      const results = [
        await createCategoryAction(null, form(valid('outdoor'))),
        await updateCategoryAction(null, form(valid('changed', { id: item!.id }))),
        await deleteCategoryAction(null, form({ id: item!.id })),
        await reorderCategoriesAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await keys()).toEqual(['indoor']);
    });
  });
});
