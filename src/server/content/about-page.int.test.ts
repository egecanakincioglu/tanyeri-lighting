import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { getAboutPage, updateAboutPage } from './about-page.ts';

const pair = (tr: string, en: string) => ({ tr, en });

const page = {
  body: pair('## Biz kimiz\n\nÖrnek metin.', '## Who we are\n\nSample text.'),
  vision: pair('## Vizyonumuz\n\nÖrnek vizyon.', '## Our vision\n\nSample vision.'),
};

describe('about page on a real database', () => {
  beforeEach(async () => {
    await getDb().aboutPage.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('reads empty texts before the first save, without storing them', async () => {
    expect(await getAboutPage()).toEqual({ body: pair('', ''), vision: pair('', '') });
    expect(await getDb().aboutPage.count()).toBe(0);
  });

  it('creates the row on the first save and reads it back', async () => {
    expect(await updateAboutPage(page)).toEqual(page);
    expect(await getAboutPage()).toEqual(page);
    expect(await getDb().aboutPage.count()).toBe(1);
  });

  it('maps each language of each text to its own column', async () => {
    await updateAboutPage(page);
    expect(await getDb().aboutPage.findFirstOrThrow()).toMatchObject({
      id: 'about',
      bodyTr: '## Biz kimiz\n\nÖrnek metin.',
      bodyEn: '## Who we are\n\nSample text.',
      visionTr: '## Vizyonumuz\n\nÖrnek vizyon.',
      visionEn: '## Our vision\n\nSample vision.',
    });
  });

  it('replaces both texts on a later save and keeps a single row', async () => {
    await updateAboutPage(page);
    const changed = { ...page, vision: pair('Yeni vizyon', 'New vision') };
    expect(await updateAboutPage(changed)).toEqual(changed);
    expect(await getAboutPage()).toEqual(changed);
    expect(await getDb().aboutPage.count()).toBe(1);
  });

  it('rejects a missing language or a missing text and keeps the stored page', async () => {
    await updateAboutPage(page);
    await expect(updateAboutPage({ ...page, body: { tr: 'Yalnız Türkçe' } })).rejects.toThrow();
    await expect(updateAboutPage({ ...page, vision: pair('Vizyon', '  ') })).rejects.toThrow();
    await expect(updateAboutPage({ body: page.body })).rejects.toThrow();
    expect(await getAboutPage()).toEqual(page);
  });

  it('refuses the write in demo mode and changes nothing', async () => {
    await updateAboutPage(page);
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(updateAboutPage({ ...page, body: pair('Başka', 'Other') })).rejects.toThrow(DemoModeError);
    await expect(updateAboutPage({})).rejects.toThrow(DemoModeError);
    expect(await getAboutPage()).toEqual(page);
  });

  it('refuses the first save in demo mode, but still reads', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(updateAboutPage(page)).rejects.toThrow(DemoModeError);
    expect(await getDb().aboutPage.count()).toBe(0);
    expect(await getAboutPage()).toEqual({ body: pair('', ''), vision: pair('', '') });
  });
});
