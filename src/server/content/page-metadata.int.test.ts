import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { getPageMetadata, upsertPageMetadata } from './page-metadata.ts';

const pair = (tr: string, en: string) => ({ tr, en });

const home = { title: pair('Ana Sayfa', 'Home'), description: pair('Ana sayfa açıklaması', 'Home description') };

describe('page metadata on a real database', () => {
  beforeEach(async () => {
    await getDb().pageMetadata.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('has no metadata for a page that was never saved', async () => {
    expect(await getPageMetadata('home')).toBeNull();
  });

  it('saves and reads metadata of a page, with the time of the change', async () => {
    const saved = await upsertPageMetadata('home', home);
    expect(saved).toEqual({ ...home, updatedAt: expect.any(Date) });
    expect(await getPageMetadata('home')).toEqual(saved);
  });

  it('maps each language to its own column', async () => {
    await upsertPageMetadata('home', home);
    expect(await getDb().pageMetadata.findUniqueOrThrow({ where: { pageKey: 'home' } })).toMatchObject({
      titleTr: 'Ana Sayfa',
      titleEn: 'Home',
      descriptionTr: 'Ana sayfa açıklaması',
      descriptionEn: 'Home description',
    });
  });

  it('keeps pages apart', async () => {
    await upsertPageMetadata('home', home);
    await upsertPageMetadata('about', { title: pair('Hakkımızda', 'About'), description: pair('A', 'B') });
    expect((await getPageMetadata('home'))?.title).toEqual(pair('Ana Sayfa', 'Home'));
    expect((await getPageMetadata('about'))?.title).toEqual(pair('Hakkımızda', 'About'));
    expect(await getPageMetadata('contact')).toBeNull();
  });

  it('replaces the metadata of a page on a later save and moves the change time forward', async () => {
    const first = await upsertPageMetadata('home', home);
    const changed = { title: pair('Yeni', 'New'), description: pair('Yeni açıklama', 'New description') };
    const second = await upsertPageMetadata('home', changed);
    expect(second).toMatchObject(changed);
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
    expect(await getDb().pageMetadata.count()).toBe(1);
  });

  it.each([
    ['a title without English', { ...home, title: { tr: 'Ana Sayfa' } }],
    ['a title with a blank language', { ...home, title: pair('Ana Sayfa', '  ') }],
    ['a description without Turkish', { ...home, description: { en: 'Home description' } }],
    ['no description', { title: home.title }],
  ])('rejects %s and keeps the stored values', async (_, input) => {
    await upsertPageMetadata('home', home);
    await expect(upsertPageMetadata('home', input)).rejects.toThrow();
    expect((await getPageMetadata('home'))?.title).toEqual(home.title);
    expect((await getPageMetadata('home'))?.description).toEqual(home.description);
  });

  it('rejects a key that is not a public page, and stores nothing', async () => {
    await expect(upsertPageMetadata('dashboard', home)).rejects.toThrow();
    await expect(upsertPageMetadata(undefined, home)).rejects.toThrow();
    expect(await getDb().pageMetadata.count()).toBe(0);
  });

  it('refuses the write in demo mode and changes nothing', async () => {
    await upsertPageMetadata('home', home);
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(
      upsertPageMetadata('home', { title: pair('Başka', 'Other'), description: home.description }),
    ).rejects.toThrow(DemoModeError);
    await expect(upsertPageMetadata('about', home)).rejects.toThrow(DemoModeError);
    await expect(upsertPageMetadata('nope', {})).rejects.toThrow(DemoModeError);
    expect(await getDb().pageMetadata.count()).toBe(1);
    expect(await getPageMetadata('home')).toMatchObject(home);
  });
});
