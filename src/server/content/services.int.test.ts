import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { ContentNotFoundError, InvalidOrderError } from './errors.ts';
import { createService, deleteService, listServices, reorderServices, updateService } from './services.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function service(name: string, note = pair('Keşif ücretsizdir.', 'The site visit is free.')) {
  return {
    imageUrl: `https://store.example.com/${name.toLowerCase()}.webp`,
    title: pair(`${name} TR`, `${name} EN`),
    description: pair(`## ${name}\n\nAçıklama.`, `## ${name}\n\nDescription.`),
    note,
  };
}

async function titles(): Promise<string[]> {
  return (await listServices()).map((item) => item.title.en);
}

describe('services on a real database', () => {
  beforeEach(async () => {
    await getDb().service.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listServices()).toEqual([]);
  });

  it('creates services at the end of the list and lists them in that order', async () => {
    const first = await createService(service('Design'));
    await createService(service('Supply'));
    await createService(service('Install'));
    expect(first).toEqual({ id: expect.any(String), ...service('Design') });
    expect(await titles()).toEqual(['Design EN', 'Supply EN', 'Install EN']);
  });

  it('maps each language to its own column', async () => {
    await createService(service('Design'));
    expect(await getDb().service.findFirstOrThrow()).toMatchObject({
      titleTr: 'Design TR',
      titleEn: 'Design EN',
      descriptionTr: '## Design\n\nAçıklama.',
      descriptionEn: '## Design\n\nDescription.',
      noteTr: 'Keşif ücretsizdir.',
      noteEn: 'The site visit is free.',
    });
  });

  it('stores a missing note as empty strings in both columns and reads it back as an empty pair', async () => {
    const created = await createService(service('Design', pair('', '')));
    expect(created.note).toEqual(pair('', ''));
    expect(await getDb().service.findFirstOrThrow()).toMatchObject({ noteTr: '', noteEn: '' });
    expect((await listServices())[0]?.note).toEqual(pair('', ''));
  });

  it('adds and removes a note on update', async () => {
    const created = await createService(service('Design', pair('', '')));
    const withNote = await updateService(created.id, service('Design'));
    expect(withNote.note).toEqual(pair('Keşif ücretsizdir.', 'The site visit is free.'));
    const without = await updateService(created.id, service('Design', pair(' ', '')));
    expect(without.note).toEqual(pair('', ''));
    expect(await getDb().service.findFirstOrThrow()).toMatchObject({ noteTr: '', noteEn: '' });
  });

  it('rejects a note in one language only and stores nothing', async () => {
    await expect(createService(service('Design', pair('Keşif ücretsizdir.', '')))).rejects.toThrow();
    await expect(createService(service('Design', pair('', 'The site visit is free.')))).rejects.toThrow();
    await expect(createService({ ...service('Design'), note: undefined })).rejects.toThrow();
    expect(await listServices()).toEqual([]);
  });

  it('rejects a note in one language only on update and keeps the stored service', async () => {
    const created = await createService(service('Design'));
    await expect(updateService(created.id, service('Design', pair('Yalnız Türkçe', '')))).rejects.toThrow();
    expect(await listServices()).toEqual([created]);
  });

  it('updates a service without moving it', async () => {
    await createService(service('Design'));
    const second = await createService(service('Supply'));
    await createService(service('Install'));
    const next = { ...service('Supply'), title: pair('Yeni', 'New') };
    expect(await updateService(second.id, next)).toEqual({ id: second.id, ...next });
    expect(await titles()).toEqual(['Design EN', 'New', 'Install EN']);
  });

  it('deletes a service and keeps the order of the others', async () => {
    await createService(service('Design'));
    const second = await createService(service('Supply'));
    await createService(service('Install'));
    await deleteService(second.id);
    expect(await titles()).toEqual(['Design EN', 'Install EN']);
    await createService(service('Repair'));
    expect(await titles()).toEqual(['Design EN', 'Install EN', 'Repair EN']);
  });

  it('reorders the list', async () => {
    const a = await createService(service('Design'));
    const b = await createService(service('Supply'));
    const c = await createService(service('Install'));
    await reorderServices([c.id, a.id, b.id]);
    expect(await titles()).toEqual(['Install EN', 'Design EN', 'Supply EN']);
  });

  it('reports a missing service on update and delete', async () => {
    await expect(updateService('missing', service('Design'))).rejects.toThrow(ContentNotFoundError);
    await expect(deleteService('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createService(service('Design'));
    const b = await createService(service('Supply'));
    const c = await createService(service('Install'));
    await expect(reorderServices(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await titles()).toEqual(['Design EN', 'Supply EN', 'Install EN']);
  });

  it('rejects invalid input and stores nothing', async () => {
    await expect(createService({ ...service('Design'), title: { tr: 'Tasarım' } })).rejects.toThrow();
    await expect(createService({ ...service('Design'), imageUrl: 'http://example.com/a.webp' })).rejects.toThrow();
    await expect(createService({ ...service('Design'), description: pair('a'.repeat(5001), 'b') })).rejects.toThrow();
    await expect(reorderServices('not a list')).rejects.toThrow();
    await expect(deleteService('')).rejects.toThrow();
    expect(await listServices()).toEqual([]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createService(service('Design'));
    const b = await createService(service('Supply'));
    const before = await listServices();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createService(service('Install'))).rejects.toThrow(DemoModeError);
    await expect(updateService(a.id, service('Install'))).rejects.toThrow(DemoModeError);
    await expect(deleteService(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderServices([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createService({})).rejects.toThrow(DemoModeError);
    expect(await listServices()).toEqual(before);
  });
});
