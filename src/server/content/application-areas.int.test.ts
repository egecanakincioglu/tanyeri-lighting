import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import {
  createApplicationArea,
  deleteApplicationArea,
  listApplicationAreas,
  reorderApplicationAreas,
  updateApplicationArea,
} from './application-areas.ts';
import { ContentNotFoundError, InvalidOrderError } from './errors.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function area(name: string) {
  return {
    imageUrl: `https://store.example.com/${name.toLowerCase()}.webp`,
    title: pair(`${name} TR`, `${name} EN`),
    description: pair('Kısa açıklama.', 'Short description.'),
  };
}

async function titles(): Promise<string[]> {
  return (await listApplicationAreas()).map((item) => item.title.en);
}

describe('application areas on a real database', () => {
  beforeEach(async () => {
    await getDb().applicationArea.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listApplicationAreas()).toEqual([]);
  });

  it('creates areas at the end of the list and lists them in that order', async () => {
    const first = await createApplicationArea(area('Hotel'));
    await createApplicationArea(area('Office'));
    await createApplicationArea(area('Shop'));
    expect(first).toEqual({ id: expect.any(String), ...area('Hotel') });
    expect(await titles()).toEqual(['Hotel EN', 'Office EN', 'Shop EN']);
  });

  it('maps each language to its own column', async () => {
    await createApplicationArea(area('Hotel'));
    expect(await getDb().applicationArea.findFirstOrThrow()).toMatchObject({
      titleTr: 'Hotel TR',
      titleEn: 'Hotel EN',
      descriptionTr: 'Kısa açıklama.',
      descriptionEn: 'Short description.',
    });
  });

  it('updates an area without moving it', async () => {
    await createApplicationArea(area('Hotel'));
    const second = await createApplicationArea(area('Office'));
    await createApplicationArea(area('Shop'));
    const next = { ...area('Office'), title: pair('Yeni', 'New') };
    expect(await updateApplicationArea(second.id, next)).toEqual({ id: second.id, ...next });
    expect(await titles()).toEqual(['Hotel EN', 'New', 'Shop EN']);
  });

  it('deletes an area and keeps the order of the others', async () => {
    await createApplicationArea(area('Hotel'));
    const second = await createApplicationArea(area('Office'));
    await createApplicationArea(area('Shop'));
    await deleteApplicationArea(second.id);
    expect(await titles()).toEqual(['Hotel EN', 'Shop EN']);
    await createApplicationArea(area('Garden'));
    expect(await titles()).toEqual(['Hotel EN', 'Shop EN', 'Garden EN']);
  });

  it('reorders the list', async () => {
    const a = await createApplicationArea(area('Hotel'));
    const b = await createApplicationArea(area('Office'));
    const c = await createApplicationArea(area('Shop'));
    await reorderApplicationAreas([c.id, a.id, b.id]);
    expect(await titles()).toEqual(['Shop EN', 'Hotel EN', 'Office EN']);
  });

  it('reports a missing area on update and delete', async () => {
    await expect(updateApplicationArea('missing', area('Hotel'))).rejects.toThrow(ContentNotFoundError);
    await expect(deleteApplicationArea('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createApplicationArea(area('Hotel'));
    const b = await createApplicationArea(area('Office'));
    const c = await createApplicationArea(area('Shop'));
    await expect(reorderApplicationAreas(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await titles()).toEqual(['Hotel EN', 'Office EN', 'Shop EN']);
  });

  it('rejects invalid input and stores nothing', async () => {
    await expect(createApplicationArea({ ...area('Hotel'), title: { tr: 'Otel' } })).rejects.toThrow();
    await expect(createApplicationArea({ ...area('Hotel'), imageUrl: 'http://example.com/a.webp' })).rejects.toThrow();
    await expect(
      createApplicationArea({ ...area('Hotel'), description: pair('a'.repeat(301), 'b') }),
    ).rejects.toThrow();
    await expect(reorderApplicationAreas('not a list')).rejects.toThrow();
    await expect(deleteApplicationArea('')).rejects.toThrow();
    expect(await listApplicationAreas()).toEqual([]);
  });

  it('rejects an invalid update and keeps the stored area', async () => {
    const created = await createApplicationArea(area('Hotel'));
    await expect(updateApplicationArea(created.id, { ...area('Hotel'), imageUrl: 'logo' })).rejects.toThrow();
    expect(await listApplicationAreas()).toEqual([created]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createApplicationArea(area('Hotel'));
    const b = await createApplicationArea(area('Office'));
    const before = await listApplicationAreas();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createApplicationArea(area('Shop'))).rejects.toThrow(DemoModeError);
    await expect(updateApplicationArea(a.id, area('Shop'))).rejects.toThrow(DemoModeError);
    await expect(deleteApplicationArea(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderApplicationAreas([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createApplicationArea({})).rejects.toThrow(DemoModeError);
    expect(await listApplicationAreas()).toEqual(before);
  });
});
