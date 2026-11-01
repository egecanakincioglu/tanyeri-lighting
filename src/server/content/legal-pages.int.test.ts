import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { getLegalPage, upsertLegalPage } from './legal-pages.ts';

const pair = (tr: string, en: string) => ({ tr, en });

const privacy = {
  title: pair('Gizlilik Politikası', 'Privacy Policy'),
  body: pair('## Veriler\n\nVerileri **korurum**.', '## Data\n\nI **protect** the data.'),
};

describe('legal pages on a real database', () => {
  beforeEach(async () => {
    await getDb().legalPage.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('has no page that was never saved', async () => {
    expect(await getLegalPage('privacy')).toBeNull();
    expect(await getLegalPage('terms')).toBeNull();
  });

  it('saves and reads a page, with the time of the change', async () => {
    const saved = await upsertLegalPage('privacy', privacy);
    expect(saved).toEqual({ ...privacy, updatedAt: expect.any(Date) });
    expect(await getLegalPage('privacy')).toEqual(saved);
  });

  it('maps each language to its own column and stores the Markdown as it is', async () => {
    await upsertLegalPage('privacy', privacy);
    expect(await getDb().legalPage.findUniqueOrThrow({ where: { pageKey: 'privacy' } })).toMatchObject({
      titleTr: 'Gizlilik Politikası',
      titleEn: 'Privacy Policy',
      bodyTr: '## Veriler\n\nVerileri **korurum**.',
      bodyEn: '## Data\n\nI **protect** the data.',
    });
  });

  it('keeps the two pages apart', async () => {
    await upsertLegalPage('privacy', privacy);
    await upsertLegalPage('terms', { title: pair('Koşullar', 'Terms'), body: pair('Metin', 'Text') });
    expect((await getLegalPage('privacy'))?.title).toEqual(privacy.title);
    expect((await getLegalPage('terms'))?.body).toEqual(pair('Metin', 'Text'));
  });

  it('replaces a page on a later save and moves the change time forward', async () => {
    const first = await upsertLegalPage('privacy', privacy);
    const changed = { title: pair('Yeni', 'New'), body: pair('Yeni metin', 'New text') };
    const second = await upsertLegalPage('privacy', changed);
    expect(second).toMatchObject(changed);
    expect(second.updatedAt.getTime()).toBeGreaterThanOrEqual(first.updatedAt.getTime());
    expect(await getDb().legalPage.count()).toBe(1);
  });

  it.each([
    ['a body without English', { ...privacy, body: { tr: 'Metin' } }],
    ['a body with a blank language', { ...privacy, body: pair('Metin', ' \n ') }],
    ['a title without Turkish', { ...privacy, title: { en: 'Privacy Policy' } }],
    ['no body', { title: privacy.title }],
  ])('rejects %s and keeps the stored page', async (_, input) => {
    await upsertLegalPage('privacy', privacy);
    await expect(upsertLegalPage('privacy', input)).rejects.toThrow();
    expect(await getLegalPage('privacy')).toMatchObject(privacy);
  });

  it('rejects a key that is not a legal page, and stores nothing', async () => {
    await expect(upsertLegalPage('home', privacy)).rejects.toThrow();
    await expect(upsertLegalPage(null, privacy)).rejects.toThrow();
    expect(await getDb().legalPage.count()).toBe(0);
  });

  it('refuses the write in demo mode and changes nothing', async () => {
    await upsertLegalPage('privacy', privacy);
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(upsertLegalPage('privacy', { title: pair('Başka', 'Other'), body: privacy.body })).rejects.toThrow(
      DemoModeError,
    );
    await expect(upsertLegalPage('terms', privacy)).rejects.toThrow(DemoModeError);
    await expect(upsertLegalPage('nope', {})).rejects.toThrow(DemoModeError);
    expect(await getDb().legalPage.count()).toBe(1);
    expect(await getLegalPage('privacy')).toMatchObject(privacy);
  });
});
