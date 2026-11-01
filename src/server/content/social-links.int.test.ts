import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { ContentNotFoundError, InvalidOrderError } from './errors.ts';
import {
  createSocialLink,
  deleteSocialLink,
  listSocialLinks,
  reorderSocialLinks,
  updateSocialLink,
} from './social-links.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function link(name: string) {
  return {
    platform: name.toLowerCase(),
    label: pair(`${name} TR`, `${name} EN`),
    url: `https://${name.toLowerCase()}.example.com/tanyeri`,
  };
}

async function platforms(): Promise<string[]> {
  return (await listSocialLinks()).map((item) => item.platform);
}

describe('social links on a real database', () => {
  beforeEach(async () => {
    await getDb().socialLink.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listSocialLinks()).toEqual([]);
  });

  it('creates links at the end of the list and lists them in that order', async () => {
    const first = await createSocialLink(link('Instagram'));
    await createSocialLink(link('Facebook'));
    await createSocialLink(link('Youtube'));
    expect(first).toEqual({ id: expect.any(String), ...link('Instagram') });
    expect(await platforms()).toEqual(['instagram', 'facebook', 'youtube']);
  });

  it('maps each language to its own column', async () => {
    await createSocialLink(link('Instagram'));
    const row = await getDb().socialLink.findFirstOrThrow();
    expect(row).toMatchObject({ labelTr: 'Instagram TR', labelEn: 'Instagram EN' });
  });

  it('updates a link without moving it', async () => {
    await createSocialLink(link('Instagram'));
    const second = await createSocialLink(link('Facebook'));
    await createSocialLink(link('Youtube'));
    const updated = await updateSocialLink(second.id, { ...link('Facebook'), label: pair('Yeni', 'New') });
    expect(updated).toEqual({ id: second.id, ...link('Facebook'), label: pair('Yeni', 'New') });
    expect(await platforms()).toEqual(['instagram', 'facebook', 'youtube']);
    expect((await listSocialLinks())[1]?.label).toEqual(pair('Yeni', 'New'));
  });

  it('deletes a link and keeps the order of the others', async () => {
    await createSocialLink(link('Instagram'));
    const second = await createSocialLink(link('Facebook'));
    await createSocialLink(link('Youtube'));
    await deleteSocialLink(second.id);
    expect(await platforms()).toEqual(['instagram', 'youtube']);
    const added = await createSocialLink(link('Pinterest'));
    expect(added.platform).toBe('pinterest');
    expect(await platforms()).toEqual(['instagram', 'youtube', 'pinterest']);
  });

  it('reorders the list', async () => {
    const a = await createSocialLink(link('Instagram'));
    const b = await createSocialLink(link('Facebook'));
    const c = await createSocialLink(link('Youtube'));
    await reorderSocialLinks([c.id, a.id, b.id]);
    expect(await platforms()).toEqual(['youtube', 'instagram', 'facebook']);
    await reorderSocialLinks([b.id, c.id, a.id]);
    expect(await platforms()).toEqual(['facebook', 'youtube', 'instagram']);
  });

  it('reports a missing link on update and delete', async () => {
    await expect(updateSocialLink('missing', link('Instagram'))).rejects.toThrow(ContentNotFoundError);
    await expect(deleteSocialLink('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createSocialLink(link('Instagram'));
    const b = await createSocialLink(link('Facebook'));
    const c = await createSocialLink(link('Youtube'));
    await expect(reorderSocialLinks(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await platforms()).toEqual(['instagram', 'facebook', 'youtube']);
  });

  it('accepts an empty order for an empty list', async () => {
    await expect(reorderSocialLinks([])).resolves.toBeUndefined();
  });

  it('rejects a missing language, a non-https address and bad ids, and stores nothing', async () => {
    await expect(createSocialLink({ ...link('Instagram'), label: { tr: 'Instagram' } })).rejects.toThrow();
    await expect(createSocialLink({ ...link('Instagram'), url: 'http://instagram.example.com' })).rejects.toThrow();
    await expect(createSocialLink({ ...link('Instagram'), url: 'javascript:alert(1)' })).rejects.toThrow();
    await expect(reorderSocialLinks('not a list')).rejects.toThrow();
    await expect(deleteSocialLink('')).rejects.toThrow();
    expect(await listSocialLinks()).toEqual([]);
  });

  it('rejects an invalid update and keeps the stored link', async () => {
    const created = await createSocialLink(link('Instagram'));
    await expect(updateSocialLink(created.id, { ...link('Instagram'), label: pair('Yeni', '') })).rejects.toThrow();
    await expect(updateSocialLink(created.id, { ...link('Instagram'), url: 'http://x.example.com' })).rejects.toThrow();
    expect(await listSocialLinks()).toEqual([created]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createSocialLink(link('Instagram'));
    const b = await createSocialLink(link('Facebook'));
    const before = await listSocialLinks();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createSocialLink(link('Youtube'))).rejects.toThrow(DemoModeError);
    await expect(updateSocialLink(a.id, link('Youtube'))).rejects.toThrow(DemoModeError);
    await expect(deleteSocialLink(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderSocialLinks([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createSocialLink({})).rejects.toThrow(DemoModeError);
    expect(await listSocialLinks()).toEqual(before);
  });
});
