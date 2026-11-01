import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { createCategory, deleteCategory, listCategories, reorderCategories, updateCategory } from './categories.ts';
import {
  CategoryLimitError,
  CategoryNotEmptyError,
  ContentNotFoundError,
  InvalidOrderError,
  ValueTakenError,
} from './errors.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function category(key: string) {
  return { key, name: pair(`${key} TR`, `${key} EN`) };
}

async function keys(): Promise<string[]> {
  return (await listCategories()).map((item) => item.key);
}

async function addProduct(categoryId: string, slug: string) {
  await getDb().product.create({
    data: {
      categoryId,
      slug,
      code: slug,
      nameTr: 'Ad',
      nameEn: 'Name',
      colorTr: 'Renk',
      colorEn: 'Color',
      materialTr: 'Malzeme',
      materialEn: 'Material',
      power: '10 W',
      dimensions: '100 mm',
      imageUrl: 'https://store.example.com/p.webp',
      sortOrder: 0,
    },
  });
}

describe('categories on a real database', () => {
  beforeEach(async () => {
    await getDb().product.deleteMany();
    await getDb().category.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listCategories()).toEqual([]);
  });

  it('creates categories at the end of the list and lists them in that order', async () => {
    const first = await createCategory(category('indoor'));
    await createCategory(category('outdoor'));
    await createCategory(category('garden'));
    expect(first).toEqual({ id: expect.any(String), ...category('indoor') });
    expect(await keys()).toEqual(['indoor', 'outdoor', 'garden']);
  });

  it('maps each language to its own column', async () => {
    await createCategory(category('indoor'));
    expect(await getDb().category.findFirstOrThrow()).toMatchObject({ nameTr: 'indoor TR', nameEn: 'indoor EN' });
  });

  it('allows 8 categories and refuses the 9th', async () => {
    for (let index = 1; index <= 8; index++) await createCategory(category(`group-${index}`));
    await expect(createCategory(category('group-9'))).rejects.toThrow(CategoryLimitError);
    expect(await keys()).toHaveLength(8);
  });

  it('allows a new category again after one is deleted', async () => {
    const created = [];
    for (let index = 1; index <= 8; index++) created.push(await createCategory(category(`group-${index}`)));
    await deleteCategory(created[3]?.id);
    await createCategory(category('group-9'));
    expect(await keys()).toEqual([
      'group-1',
      'group-2',
      'group-3',
      'group-5',
      'group-6',
      'group-7',
      'group-8',
      'group-9',
    ]);
  });

  it('refuses a key that is already used, on create and on update', async () => {
    await createCategory(category('indoor'));
    const outdoor = await createCategory(category('outdoor'));
    await expect(createCategory(category('indoor'))).rejects.toThrow(ValueTakenError);
    await expect(updateCategory(outdoor.id, category('indoor'))).rejects.toThrow(ValueTakenError);
    expect(await keys()).toEqual(['indoor', 'outdoor']);
  });

  it('lets one of two concurrent writers of the same key win, with the same error as a failed check', async () => {
    const created = await Promise.allSettled([createCategory(category('indoor')), createCategory(category('indoor'))]);
    expect(created.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(created.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { name: 'ValueTakenError', field: 'key' },
    });
    expect(await keys()).toEqual(['indoor']);

    const a = await createCategory(category('outdoor'));
    const b = await createCategory(category('garden'));
    const updated = await Promise.allSettled([
      updateCategory(a.id, category('shared')),
      updateCategory(b.id, category('shared')),
    ]);
    expect(updated.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(updated.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { name: 'ValueTakenError', field: 'key' },
    });
  });

  it('updates a category without moving it, and may keep its own key', async () => {
    await createCategory(category('indoor'));
    const second = await createCategory(category('outdoor'));
    await createCategory(category('garden'));
    const updated = await updateCategory(second.id, { key: 'outdoor', name: pair('Dış mekan', 'Outdoor') });
    expect(updated).toEqual({ id: second.id, key: 'outdoor', name: pair('Dış mekan', 'Outdoor') });
    await updateCategory(second.id, category('exterior'));
    expect(await keys()).toEqual(['indoor', 'exterior', 'garden']);
  });

  it('deletes a category and keeps the order of the others', async () => {
    await createCategory(category('indoor'));
    const second = await createCategory(category('outdoor'));
    await createCategory(category('garden'));
    await deleteCategory(second.id);
    expect(await keys()).toEqual(['indoor', 'garden']);
    await createCategory(category('office'));
    expect(await keys()).toEqual(['indoor', 'garden', 'office']);
  });

  it('refuses to delete a category that still has products, and deletes it once they are gone', async () => {
    const created = await createCategory(category('indoor'));
    await addProduct(created.id, 'lamp-1');
    await expect(deleteCategory(created.id)).rejects.toThrow(CategoryNotEmptyError);
    expect(await keys()).toEqual(['indoor']);
    await getDb().product.deleteMany();
    await deleteCategory(created.id);
    expect(await keys()).toEqual([]);
  });

  it('reports a missing category on update and delete', async () => {
    await expect(updateCategory('missing', category('indoor'))).rejects.toThrow(ContentNotFoundError);
    await expect(deleteCategory('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it('reorders the list', async () => {
    const a = await createCategory(category('indoor'));
    const b = await createCategory(category('outdoor'));
    const c = await createCategory(category('garden'));
    await reorderCategories([c.id, a.id, b.id]);
    expect(await keys()).toEqual(['garden', 'indoor', 'outdoor']);
    await reorderCategories([b.id, c.id, a.id]);
    expect(await keys()).toEqual(['outdoor', 'garden', 'indoor']);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createCategory(category('indoor'));
    const b = await createCategory(category('outdoor'));
    const c = await createCategory(category('garden'));
    await expect(reorderCategories(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await keys()).toEqual(['indoor', 'outdoor', 'garden']);
  });

  it('rejects invalid input and stores nothing', async () => {
    await expect(createCategory({ ...category('indoor'), name: { tr: 'İç' } })).rejects.toThrow();
    await expect(createCategory(category('Indoor'))).rejects.toThrow();
    await expect(createCategory(category('in door'))).rejects.toThrow();
    await expect(reorderCategories('not a list')).rejects.toThrow();
    await expect(deleteCategory('')).rejects.toThrow();
    expect(await listCategories()).toEqual([]);
  });

  it('rejects an invalid update and keeps the stored category', async () => {
    const created = await createCategory(category('indoor'));
    await expect(updateCategory(created.id, { key: 'indoor', name: pair('İç', '') })).rejects.toThrow();
    await expect(updateCategory(created.id, category('bad key'))).rejects.toThrow();
    expect(await listCategories()).toEqual([created]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createCategory(category('indoor'));
    const b = await createCategory(category('outdoor'));
    const before = await listCategories();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createCategory(category('garden'))).rejects.toThrow(DemoModeError);
    await expect(updateCategory(a.id, category('garden'))).rejects.toThrow(DemoModeError);
    await expect(deleteCategory(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderCategories([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createCategory({})).rejects.toThrow(DemoModeError);
    expect(await listCategories()).toEqual(before);
  });
});
