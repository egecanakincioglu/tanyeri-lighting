import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { ContentNotFoundError, InvalidOrderError } from './errors.ts';
import { createReference, deleteReference, listReferences, reorderReferences, updateReference } from './references.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function reference(name: string) {
  return {
    imageUrl: `https://store.example.com/${name.toLowerCase()}.webp`,
    name,
    title: pair(`${name} işi`, `${name} work`),
    description: pair('Kısa açıklama.', 'Short description.'),
  };
}

async function names(): Promise<string[]> {
  return (await listReferences()).map((item) => item.name);
}

describe('references on a real database', () => {
  beforeEach(async () => {
    await getDb().reference.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listReferences()).toEqual([]);
  });

  it('creates references at the end of the list and lists them in that order', async () => {
    const first = await createReference(reference('Alpha Hotel'));
    await createReference(reference('Beta Studio'));
    await createReference(reference('Gamma Cafe'));
    expect(first).toEqual({ id: expect.any(String), ...reference('Alpha Hotel') });
    expect(await names()).toEqual(['Alpha Hotel', 'Beta Studio', 'Gamma Cafe']);
  });

  it('keeps the name in one column and maps each language to its own column', async () => {
    await createReference(reference('Alpha Hotel'));
    const row = await getDb().reference.findFirstOrThrow();
    expect(row).toMatchObject({
      name: 'Alpha Hotel',
      titleTr: 'Alpha Hotel işi',
      titleEn: 'Alpha Hotel work',
      descriptionTr: 'Kısa açıklama.',
      descriptionEn: 'Short description.',
    });
  });

  it('updates a reference without moving it', async () => {
    await createReference(reference('Alpha Hotel'));
    const second = await createReference(reference('Beta Studio'));
    await createReference(reference('Gamma Cafe'));
    const changed = { ...reference('Beta Studio'), title: pair('Yeni', 'New') };
    expect(await updateReference(second.id, changed)).toEqual({ id: second.id, ...changed });
    expect(await names()).toEqual(['Alpha Hotel', 'Beta Studio', 'Gamma Cafe']);
    expect((await listReferences())[1]?.title).toEqual(pair('Yeni', 'New'));
  });

  it('deletes a reference and keeps the order of the others', async () => {
    await createReference(reference('Alpha Hotel'));
    const second = await createReference(reference('Beta Studio'));
    await createReference(reference('Gamma Cafe'));
    await deleteReference(second.id);
    expect(await names()).toEqual(['Alpha Hotel', 'Gamma Cafe']);
    await createReference(reference('Delta Shop'));
    expect(await names()).toEqual(['Alpha Hotel', 'Gamma Cafe', 'Delta Shop']);
  });

  it('reorders the list', async () => {
    const a = await createReference(reference('Alpha Hotel'));
    const b = await createReference(reference('Beta Studio'));
    const c = await createReference(reference('Gamma Cafe'));
    await reorderReferences([c.id, a.id, b.id]);
    expect(await names()).toEqual(['Gamma Cafe', 'Alpha Hotel', 'Beta Studio']);
    await reorderReferences([b.id, c.id, a.id]);
    expect(await names()).toEqual(['Beta Studio', 'Gamma Cafe', 'Alpha Hotel']);
  });

  it('reports a missing reference on update and delete', async () => {
    await expect(updateReference('missing', reference('Alpha Hotel'))).rejects.toThrow(ContentNotFoundError);
    await expect(deleteReference('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createReference(reference('Alpha Hotel'));
    const b = await createReference(reference('Beta Studio'));
    const c = await createReference(reference('Gamma Cafe'));
    await expect(reorderReferences(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await names()).toEqual(['Alpha Hotel', 'Beta Studio', 'Gamma Cafe']);
  });

  it('accepts an empty order for an empty list', async () => {
    await expect(reorderReferences([])).resolves.toBeUndefined();
  });

  it('rejects a missing language, a non-https address and bad ids, and stores nothing', async () => {
    await expect(createReference({ ...reference('Alpha Hotel'), title: { tr: 'Otel' } })).rejects.toThrow();
    await expect(createReference({ ...reference('Alpha Hotel'), description: pair('Metin', ' ') })).rejects.toThrow();
    await expect(
      createReference({ ...reference('Alpha Hotel'), imageUrl: 'http://example.com/a.webp' }),
    ).rejects.toThrow();
    await expect(createReference({ ...reference('Alpha Hotel'), imageUrl: 'javascript:alert(1)' })).rejects.toThrow();
    await expect(createReference({ ...reference('Alpha Hotel'), name: ' ' })).rejects.toThrow();
    await expect(reorderReferences('not a list')).rejects.toThrow();
    await expect(deleteReference('')).rejects.toThrow();
    expect(await listReferences()).toEqual([]);
  });

  it('rejects an invalid update and keeps the stored reference', async () => {
    const created = await createReference(reference('Alpha Hotel'));
    await expect(
      updateReference(created.id, { ...reference('Alpha Hotel'), title: pair('Yeni', '') }),
    ).rejects.toThrow();
    await expect(
      updateReference(created.id, { ...reference('Alpha Hotel'), imageUrl: 'http://example.com/a.webp' }),
    ).rejects.toThrow();
    expect(await listReferences()).toEqual([created]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createReference(reference('Alpha Hotel'));
    const b = await createReference(reference('Beta Studio'));
    const before = await listReferences();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createReference(reference('Gamma Cafe'))).rejects.toThrow(DemoModeError);
    await expect(updateReference(a.id, reference('Gamma Cafe'))).rejects.toThrow(DemoModeError);
    await expect(deleteReference(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderReferences([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createReference({})).rejects.toThrow(DemoModeError);
    expect(await listReferences()).toEqual(before);
  });
});
