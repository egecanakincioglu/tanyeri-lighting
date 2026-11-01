import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { getSiteSettings, updateSiteSettings } from './site-settings.ts';

const pair = (tr: string, en: string) => ({ tr, en });

const settings = {
  siteName: pair('Tanyeri Aydınlatma', 'Tanyeri Lighting'),
  logoUrl: 'https://store.public.blob.vercel-storage.com/logo.webp',
  phone: '+90 212 000 00 00',
  email: 'info@example.com',
  address: pair('Örnek Mah. 1, Ankara', 'Ornek District 1, Ankara'),
  workingHours: pair('Pazartesi-Cumartesi 09:00-18:00', 'Monday-Saturday 09:00-18:00'),
  serviceArea: pair('Türkiye geneli', 'All over Turkey'),
  languages: pair('Türkçe, İngilizce', 'Turkish, English'),
};

describe('site settings on a real database', () => {
  beforeEach(async () => {
    await getDb().siteSettings.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('reads an empty default before the first save, without storing it', async () => {
    const result = await getSiteSettings();
    expect(result.logoUrl).toBeNull();
    expect(result.siteName).toEqual(pair('', ''));
    expect(result.languages).toEqual(pair('', ''));
    expect(await getDb().siteSettings.count()).toBe(0);
  });

  it('creates the row on the first save and reads it back', async () => {
    expect(await updateSiteSettings(settings)).toEqual(settings);
    expect(await getSiteSettings()).toEqual(settings);
    expect(await getDb().siteSettings.count()).toBe(1);
  });

  it('maps each language to its own column', async () => {
    await updateSiteSettings(settings);
    const row = await getDb().siteSettings.findFirstOrThrow();
    expect(row).toMatchObject({ siteNameTr: 'Tanyeri Aydınlatma', siteNameEn: 'Tanyeri Lighting' });
    expect(row).toMatchObject({ addressTr: 'Örnek Mah. 1, Ankara', addressEn: 'Ornek District 1, Ankara' });
  });

  it('replaces the values on a later save and keeps a single row', async () => {
    await updateSiteSettings(settings);
    const changed = { ...settings, siteName: pair('Yeni Ad', 'New Name'), logoUrl: null };
    expect(await updateSiteSettings(changed)).toEqual(changed);
    expect(await getSiteSettings()).toEqual(changed);
    expect(await getDb().siteSettings.count()).toBe(1);
  });

  it('trims the values it stores', async () => {
    await updateSiteSettings({ ...settings, siteName: pair('  Tanyeri ', ' Tanyeri Lighting  ') });
    expect((await getSiteSettings()).siteName).toEqual(pair('Tanyeri', 'Tanyeri Lighting'));
  });

  it('rejects a missing language and keeps the stored values', async () => {
    await updateSiteSettings(settings);
    await expect(updateSiteSettings({ ...settings, address: { tr: 'Örnek Mah. 1' } })).rejects.toThrow();
    await expect(updateSiteSettings({ ...settings, address: pair('Örnek Mah. 1', '  ') })).rejects.toThrow();
    expect(await getSiteSettings()).toEqual(settings);
  });

  it('rejects an invalid phone number or email and keeps the stored values', async () => {
    await updateSiteSettings(settings);
    await expect(updateSiteSettings({ ...settings, phone: '12345' })).rejects.toThrow();
    await expect(updateSiteSettings({ ...settings, phone: 'tel:+902120000000' })).rejects.toThrow();
    await expect(updateSiteSettings({ ...settings, email: 'not an email' })).rejects.toThrow();
    await expect(updateSiteSettings({ ...settings, email: pair('a@example.com', 'a@example.com') })).rejects.toThrow();
    expect(await getSiteSettings()).toEqual(settings);
  });

  it('stores the phone number and the email as single values', async () => {
    await updateSiteSettings({ ...settings, phone: ' (0312) 123-45-67 ', email: ' info@example.com ' });
    expect(await getDb().siteSettings.findFirstOrThrow()).toMatchObject({
      phone: '(0312) 123-45-67',
      email: 'info@example.com',
    });
  });

  it('rejects a save that has no row yet and misses a language, without creating the row', async () => {
    await expect(updateSiteSettings({ ...settings, address: { en: 'Ornek District 1' } })).rejects.toThrow();
    expect(await getDb().siteSettings.count()).toBe(0);
  });

  it('refuses the write in demo mode and changes nothing', async () => {
    await updateSiteSettings(settings);
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(updateSiteSettings({ ...settings, siteName: pair('Başka', 'Other') })).rejects.toThrow(DemoModeError);
    await expect(updateSiteSettings({})).rejects.toThrow(DemoModeError);
    expect(await getSiteSettings()).toEqual(settings);
  });

  it('refuses the first save in demo mode, but still reads', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(updateSiteSettings(settings)).rejects.toThrow(DemoModeError);
    expect(await getDb().siteSettings.count()).toBe(0);
    expect((await getSiteSettings()).logoUrl).toBeNull();
  });
});
