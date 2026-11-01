import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { getHomeBanner, updateHomeBanner } from './home-banner.ts';

const pair = (tr: string, en: string) => ({ tr, en });

const banner = {
  imageUrl: 'https://store.public.blob.vercel-storage.com/banner.webp',
  title: pair('Işığın doğru yeri', 'Light in the right place'),
  description: pair('Evler ve iş yerleri için aydınlatma.', 'Lighting for homes and workplaces.'),
  primaryAction: { label: pair('Ürünler', 'Products'), target: 'products' as const },
  secondaryAction: { label: pair('İletişim', 'Contact'), target: 'contact' as const },
};

describe('home banner on a real database', () => {
  beforeEach(async () => {
    await getDb().homeBanner.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('reads an empty default before the first save, without storing it', async () => {
    const result = await getHomeBanner();
    expect(result.imageUrl).toBe('');
    expect(result.title).toEqual(pair('', ''));
    expect(result.primaryAction).toEqual({ label: pair('', ''), target: 'products' });
    expect(result.secondaryAction).toEqual({ label: pair('', ''), target: 'contact' });
    expect(await getDb().homeBanner.count()).toBe(0);
  });

  it('creates the row on the first save and reads it back', async () => {
    expect(await updateHomeBanner(banner)).toEqual(banner);
    expect(await getHomeBanner()).toEqual(banner);
    expect(await getDb().homeBanner.count()).toBe(1);
  });

  it('maps each language and each action to its own columns', async () => {
    await updateHomeBanner(banner);
    expect(await getDb().homeBanner.findFirstOrThrow()).toMatchObject({
      id: 'home',
      titleTr: 'Işığın doğru yeri',
      titleEn: 'Light in the right place',
      primaryLabelTr: 'Ürünler',
      primaryLabelEn: 'Products',
      primaryTarget: 'products',
      secondaryLabelTr: 'İletişim',
      secondaryLabelEn: 'Contact',
      secondaryTarget: 'contact',
    });
  });

  it('replaces the values on a later save and keeps a single row', async () => {
    await updateHomeBanner(banner);
    const changed = {
      ...banner,
      title: pair('Yeni', 'New'),
      primaryAction: { label: pair('Kataloglar', 'Catalogs'), target: 'catalogs' as const },
    };
    expect(await updateHomeBanner(changed)).toEqual(changed);
    expect(await getHomeBanner()).toEqual(changed);
    expect(await getDb().homeBanner.count()).toBe(1);
  });

  it('rejects an action target that is no page and keeps the stored banner', async () => {
    await updateHomeBanner(banner);
    const bad = { ...banner, secondaryAction: { label: pair('Yönetim', 'Admin'), target: 'admin' } };
    await expect(updateHomeBanner(bad)).rejects.toThrow();
    expect(await getHomeBanner()).toEqual(banner);
  });

  it('rejects a missing language and a non-https image, and stores nothing', async () => {
    await expect(updateHomeBanner({ ...banner, title: { tr: 'Işığın doğru yeri' } })).rejects.toThrow();
    await expect(updateHomeBanner({ ...banner, imageUrl: 'http://example.com/banner.webp' })).rejects.toThrow();
    expect(await getDb().homeBanner.count()).toBe(0);
  });

  it('refuses the write in demo mode and changes nothing', async () => {
    await updateHomeBanner(banner);
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(updateHomeBanner({ ...banner, title: pair('Başka', 'Other') })).rejects.toThrow(DemoModeError);
    await expect(updateHomeBanner({})).rejects.toThrow(DemoModeError);
    expect(await getHomeBanner()).toEqual(banner);
  });

  it('refuses the first save in demo mode, but still reads', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(updateHomeBanner(banner)).rejects.toThrow(DemoModeError);
    expect(await getDb().homeBanner.count()).toBe(0);
    expect((await getHomeBanner()).imageUrl).toBe('');
  });
});
