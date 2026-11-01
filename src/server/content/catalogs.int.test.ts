import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { createCatalog, deleteCatalog, listCatalogs, reorderCatalogs, updateCatalog } from './catalogs.ts';
import { ContentNotFoundError, InvalidOrderError } from './errors.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function catalog(name: string) {
  return {
    name: pair(`${name} TR`, `${name} EN`),
    pdfUrl: `https://store.example.com/${name.toLowerCase()}.pdf`,
    sizeBytes: 1_000_000,
  };
}

async function urls(): Promise<string[]> {
  return (await listCatalogs()).map((item) => item.pdfUrl.split('/').pop() ?? '');
}

describe('catalogs on a real database', () => {
  beforeEach(async () => {
    await getDb().promoBoard.deleteMany();
    await getDb().catalog.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listCatalogs()).toEqual([]);
  });

  it('creates catalogs at the end of the list and lists them in that order', async () => {
    const first = await createCatalog(catalog('General'));
    await createCatalog(catalog('Outdoor'));
    await createCatalog(catalog('Office'));
    expect(first).toEqual({ id: expect.any(String), ...catalog('General') });
    expect(await urls()).toEqual(['general.pdf', 'outdoor.pdf', 'office.pdf']);
  });

  it('maps each language to its own column and keeps the size', async () => {
    await createCatalog({ ...catalog('General'), sizeBytes: 2_345_678 });
    expect(await getDb().catalog.findFirstOrThrow()).toMatchObject({
      nameTr: 'General TR',
      nameEn: 'General EN',
      sizeBytes: 2_345_678,
    });
  });

  it('updates a catalog without moving it', async () => {
    await createCatalog(catalog('General'));
    const second = await createCatalog(catalog('Outdoor'));
    await createCatalog(catalog('Office'));
    const next = { name: pair('Yeni', 'New'), pdfUrl: 'https://store.example.com/new.pdf', sizeBytes: 42 };
    expect(await updateCatalog(second.id, next)).toEqual({ id: second.id, ...next });
    expect(await urls()).toEqual(['general.pdf', 'new.pdf', 'office.pdf']);
  });

  it('deletes a catalog and keeps the order of the others', async () => {
    await createCatalog(catalog('General'));
    const second = await createCatalog(catalog('Outdoor'));
    await createCatalog(catalog('Office'));
    await deleteCatalog(second.id);
    expect(await urls()).toEqual(['general.pdf', 'office.pdf']);
    await createCatalog(catalog('Garden'));
    expect(await urls()).toEqual(['general.pdf', 'office.pdf', 'garden.pdf']);
  });

  it('reorders the list', async () => {
    const a = await createCatalog(catalog('General'));
    const b = await createCatalog(catalog('Outdoor'));
    const c = await createCatalog(catalog('Office'));
    await reorderCatalogs([c.id, a.id, b.id]);
    expect(await urls()).toEqual(['office.pdf', 'general.pdf', 'outdoor.pdf']);
  });

  it('reports a missing catalog on update and delete', async () => {
    await expect(updateCatalog('missing', catalog('General'))).rejects.toThrow(ContentNotFoundError);
    await expect(deleteCatalog('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createCatalog(catalog('General'));
    const b = await createCatalog(catalog('Outdoor'));
    const c = await createCatalog(catalog('Office'));
    await expect(reorderCatalogs(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await urls()).toEqual(['general.pdf', 'outdoor.pdf', 'office.pdf']);
  });

  it('rejects invalid input and stores nothing', async () => {
    await expect(createCatalog({ ...catalog('General'), name: { tr: 'Genel' } })).rejects.toThrow();
    await expect(createCatalog({ ...catalog('General'), pdfUrl: 'http://store.example.com/g.pdf' })).rejects.toThrow();
    await expect(createCatalog({ ...catalog('General'), sizeBytes: 0 })).rejects.toThrow();
    await expect(reorderCatalogs('not a list')).rejects.toThrow();
    await expect(deleteCatalog('')).rejects.toThrow();
    expect(await listCatalogs()).toEqual([]);
  });

  it('rejects an invalid update and keeps the stored catalog', async () => {
    const created = await createCatalog(catalog('General'));
    await expect(updateCatalog(created.id, { ...catalog('General'), sizeBytes: -5 })).rejects.toThrow();
    expect(await listCatalogs()).toEqual([created]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createCatalog(catalog('General'));
    const b = await createCatalog(catalog('Outdoor'));
    const before = await listCatalogs();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createCatalog(catalog('Office'))).rejects.toThrow(DemoModeError);
    await expect(updateCatalog(a.id, catalog('Office'))).rejects.toThrow(DemoModeError);
    await expect(deleteCatalog(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderCatalogs([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createCatalog({})).rejects.toThrow(DemoModeError);
    expect(await listCatalogs()).toEqual(before);
  });
});
