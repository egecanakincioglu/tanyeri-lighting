import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { createCatalog, deleteCatalog, updateCatalog } from './catalogs.ts';
import { CatalogInUseError, ContentNotFoundError, InvalidOrderError } from './errors.ts';
import {
  createPromoBoard,
  deletePromoBoard,
  listPromoBoards,
  reorderPromoBoards,
  updatePromoBoard,
} from './promo-boards.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function board(catalogId: string, name: string) {
  return {
    imageUrl: `https://store.example.com/${name.toLowerCase()}.webp`,
    title: pair(`${name} TR`, `${name} EN`),
    catalogId,
  };
}

async function clean(): Promise<void> {
  // The boards go first: the foreign key refuses to delete a catalog that a board links to.
  await getDb().promoBoard.deleteMany();
  await getDb().catalog.deleteMany();
}

async function titles(): Promise<string[]> {
  return (await listPromoBoards()).map((item) => item.title.en);
}

describe('promo boards on a real database', () => {
  let general: { id: string };
  let outdoor: { id: string };

  beforeEach(async () => {
    await clean();
    general = await createCatalog({
      name: pair('Genel', 'General'),
      pdfUrl: 'https://store.example.com/general.pdf',
      sizeBytes: 1000,
    });
    outdoor = await createCatalog({
      name: pair('Dış mekan', 'Outdoor'),
      pdfUrl: 'https://store.example.com/outdoor.pdf',
      sizeBytes: 2000,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await clean();
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listPromoBoards()).toEqual([]);
  });

  it('creates boards at the end of the list, each with the name and file address of its catalog', async () => {
    const first = await createPromoBoard(board(general.id, 'Spring'));
    await createPromoBoard(board(outdoor.id, 'Summer'));
    await createPromoBoard(board(general.id, 'Autumn'));
    expect(first).toEqual({
      id: expect.any(String),
      ...board(general.id, 'Spring'),
      catalogName: pair('Genel', 'General'),
      catalogPdfUrl: 'https://store.example.com/general.pdf',
    });
    expect(await titles()).toEqual(['Spring EN', 'Summer EN', 'Autumn EN']);
    expect((await listPromoBoards())[1]).toMatchObject({
      catalogId: outdoor.id,
      catalogName: pair('Dış mekan', 'Outdoor'),
      catalogPdfUrl: 'https://store.example.com/outdoor.pdf',
    });
  });

  it('maps each language to its own column', async () => {
    await createPromoBoard(board(general.id, 'Spring'));
    expect(await getDb().promoBoard.findFirstOrThrow()).toMatchObject({
      titleTr: 'Spring TR',
      titleEn: 'Spring EN',
      catalogId: general.id,
    });
  });

  it('shows the current name and file address when the catalog changes', async () => {
    await createPromoBoard(board(general.id, 'Spring'));
    await updateCatalog(general.id, {
      name: pair('Yeni genel', 'New general'),
      pdfUrl: 'https://store.example.com/new.pdf',
      sizeBytes: 5,
    });
    expect((await listPromoBoards())[0]).toMatchObject({
      catalogName: pair('Yeni genel', 'New general'),
      catalogPdfUrl: 'https://store.example.com/new.pdf',
    });
  });

  it('updates a board, also its catalog, without moving it', async () => {
    await createPromoBoard(board(general.id, 'Spring'));
    const second = await createPromoBoard(board(general.id, 'Summer'));
    await createPromoBoard(board(general.id, 'Autumn'));
    const next = { ...board(outdoor.id, 'Summer'), title: pair('Yeni', 'New') };
    expect(await updatePromoBoard(second.id, next)).toMatchObject({ id: second.id, ...next, catalogId: outdoor.id });
    expect(await titles()).toEqual(['Spring EN', 'New', 'Autumn EN']);
  });

  it('deletes a board and keeps the order of the others', async () => {
    await createPromoBoard(board(general.id, 'Spring'));
    const second = await createPromoBoard(board(general.id, 'Summer'));
    await createPromoBoard(board(general.id, 'Autumn'));
    await deletePromoBoard(second.id);
    expect(await titles()).toEqual(['Spring EN', 'Autumn EN']);
    await createPromoBoard(board(general.id, 'Winter'));
    expect(await titles()).toEqual(['Spring EN', 'Autumn EN', 'Winter EN']);
  });

  it('reorders the list', async () => {
    const a = await createPromoBoard(board(general.id, 'Spring'));
    const b = await createPromoBoard(board(general.id, 'Summer'));
    const c = await createPromoBoard(board(general.id, 'Autumn'));
    await reorderPromoBoards([c.id, a.id, b.id]);
    expect(await titles()).toEqual(['Autumn EN', 'Spring EN', 'Summer EN']);
  });

  it('rejects a catalog that does not exist on create and update, and changes nothing', async () => {
    await expect(createPromoBoard(board('missing', 'Spring'))).rejects.toThrow(ContentNotFoundError);
    expect(await listPromoBoards()).toEqual([]);
    const created = await createPromoBoard(board(general.id, 'Spring'));
    await expect(updatePromoBoard(created.id, board('missing', 'Spring'))).rejects.toThrow(ContentNotFoundError);
    expect(await listPromoBoards()).toEqual([created]);
  });

  it('reports a missing board on update and delete', async () => {
    await expect(updatePromoBoard('missing', board(general.id, 'Spring'))).rejects.toThrow(ContentNotFoundError);
    await expect(deletePromoBoard('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createPromoBoard(board(general.id, 'Spring'));
    const b = await createPromoBoard(board(general.id, 'Summer'));
    const c = await createPromoBoard(board(general.id, 'Autumn'));
    await expect(reorderPromoBoards(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await titles()).toEqual(['Spring EN', 'Summer EN', 'Autumn EN']);
  });

  it('rejects invalid input and stores nothing', async () => {
    await expect(createPromoBoard({ ...board(general.id, 'Spring'), title: { tr: 'Bahar' } })).rejects.toThrow();
    await expect(
      createPromoBoard({ ...board(general.id, 'Spring'), imageUrl: 'http://example.com/a.webp' }),
    ).rejects.toThrow();
    await expect(createPromoBoard({ ...board(general.id, 'Spring'), catalogId: '' })).rejects.toThrow();
    await expect(reorderPromoBoards('not a list')).rejects.toThrow();
    await expect(deletePromoBoard('')).rejects.toThrow();
    expect(await listPromoBoards()).toEqual([]);
  });

  describe('deleting a catalog that a board links to', () => {
    it('is refused with CatalogInUseError and keeps the catalog and the board', async () => {
      const created = await createPromoBoard(board(general.id, 'Spring'));
      await expect(deleteCatalog(general.id)).rejects.toThrow(CatalogInUseError);
      expect(await getDb().catalog.count({ where: { id: general.id } })).toBe(1);
      expect(await listPromoBoards()).toEqual([created]);
    });

    it('is allowed for another catalog that no board links to', async () => {
      await createPromoBoard(board(general.id, 'Spring'));
      await deleteCatalog(outdoor.id);
      expect(await getDb().catalog.count({ where: { id: outdoor.id } })).toBe(0);
    });

    it('is allowed again once the board is deleted or links to another catalog', async () => {
      const first = await createPromoBoard(board(general.id, 'Spring'));
      await deletePromoBoard(first.id);
      await deleteCatalog(general.id);
      const second = await createPromoBoard(board(outdoor.id, 'Summer'));
      const office = await createCatalog({
        name: pair('Ofis', 'Office'),
        pdfUrl: 'https://store.example.com/office.pdf',
        sizeBytes: 3,
      });
      await expect(deleteCatalog(outdoor.id)).rejects.toThrow(CatalogInUseError);
      await updatePromoBoard(second.id, board(office.id, 'Summer'));
      await deleteCatalog(outdoor.id);
      expect(await getDb().catalog.count()).toBe(1);
    });
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createPromoBoard(board(general.id, 'Spring'));
    const b = await createPromoBoard(board(general.id, 'Summer'));
    const before = await listPromoBoards();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createPromoBoard(board(general.id, 'Autumn'))).rejects.toThrow(DemoModeError);
    await expect(updatePromoBoard(a.id, board(outdoor.id, 'Autumn'))).rejects.toThrow(DemoModeError);
    await expect(deletePromoBoard(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderPromoBoards([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createPromoBoard({})).rejects.toThrow(DemoModeError);
    expect(await listPromoBoards()).toEqual(before);
  });
});
