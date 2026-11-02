import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError } from '../auth/guard.ts';
import { getDb } from '../db.ts';
import { getLegalPage } from '../content/legal-pages.ts';
import { getPageMetadata } from '../content/page-metadata.ts';
import { saveLegalPageAction } from './legal-pages-actions.ts';
import { deleteMessageAction } from './messages-actions.ts';
import { savePageMetadataAction } from './page-metadata-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), refresh: vi.fn() }));

vi.mock('../auth/guard.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/guard.ts')>()),
  guardAction: mocks.guardAction,
}));
vi.mock('next/cache', () => ({ refresh: mocks.refresh }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  redirect: (target: string) => {
    throw new Error(`redirect:${target}`);
  },
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const legal = (extra: Record<string, string> = {}) => ({
  pageKey: 'privacy',
  'title.tr': 'Gizlilik',
  'title.en': 'Privacy',
  'body.tr': '## Veriler',
  'body.en': '## Data',
  ...extra,
});

const seo = (extra: Record<string, string> = {}) => ({
  pageKey: 'vision',
  'title.tr': 'Vizyonumuz',
  'title.en': 'Our vision',
  'description.tr': 'Açıklama',
  'description.en': 'Description',
  ...extra,
});

async function newMessage(): Promise<string> {
  const row = await getDb().contactMessage.create({
    data: { name: 'Visitor', email: 'visitor@example.com', subject: 'Hello', message: 'Text', locale: 'en' },
  });
  return row.id;
}

describe('the messages, legal pages and page info actions on a real database', () => {
  beforeEach(async () => {
    await getDb().contactMessage.deleteMany();
    await getDb().legalPage.deleteMany();
    await getDb().pageMetadata.deleteMany();
    mocks.guardAction.mockClear();
    mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
    mocks.refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  describe('deleteMessageAction', () => {
    it('deletes the message and sends the browser to the list of the language', async () => {
      const id = await newMessage();
      await expect(deleteMessageAction(null, form({ id, locale: 'en' }))).rejects.toThrow(
        'redirect:/en/admin/messages',
      );
      expect(await getDb().contactMessage.count()).toBe(0);
      const other = await newMessage();
      await expect(deleteMessageAction(null, form({ id: other, locale: 'tr' }))).rejects.toThrow(
        'redirect:/tr/yonetim/mesajlar',
      );
    });

    it('refuses without a session and in demo mode, and keeps the message', async () => {
      const id = await newMessage();
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
      expect(await deleteMessageAction(null, form({ id }))).toMatchObject({ status: 'error', code: 'unauthorized' });
      mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
      vi.stubEnv('DEMO_MODE', 'true');
      expect(await deleteMessageAction(null, form({ id }))).toMatchObject({ status: 'error', code: 'demo' });
      expect(await getDb().contactMessage.count()).toBe(1);
    });
  });

  describe('saveLegalPageAction', () => {
    it('saves a page, and saving again changes it', async () => {
      expect(await saveLegalPageAction(null, form(legal()))).toEqual({ status: 'success' });
      expect(await getLegalPage('privacy')).toMatchObject({ title: { tr: 'Gizlilik', en: 'Privacy' } });
      await saveLegalPageAction(null, form(legal({ 'title.en': 'Privacy Policy' })));
      expect(await getLegalPage('privacy')).toMatchObject({ title: { en: 'Privacy Policy' } });
      expect(mocks.refresh).toHaveBeenCalledTimes(2);
    });

    it('hides the page when all four texts are empty', async () => {
      await saveLegalPageAction(null, form(legal()));
      const empty = legal({ 'title.tr': '', 'title.en': ' ', 'body.tr': '', 'body.en': '' });
      expect(await saveLegalPageAction(null, form(empty))).toEqual({ status: 'success' });
      expect(await getLegalPage('privacy')).toBeNull();
    });

    it('reports the empty fields when only some are empty, and keeps the saved page', async () => {
      await saveLegalPageAction(null, form(legal()));
      const result = await saveLegalPageAction(null, form(legal({ 'body.en': '' })));
      expect(result).toEqual({ status: 'error', code: 'invalid', fieldErrors: { 'body.en': { code: 'required' } } });
      expect(await getLegalPage('privacy')).toMatchObject({ body: { en: '## Data' } });
    });

    it('refuses a key that is not a legal page', async () => {
      expect(await saveLegalPageAction(null, form(legal({ pageKey: 'home' })))).toMatchObject({ code: 'invalid' });
      expect(await getDb().legalPage.count()).toBe(0);
    });

    it('refuses without a session and in demo mode', async () => {
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
      expect(await saveLegalPageAction(null, form(legal()))).toMatchObject({ code: 'unauthorized' });
      mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
      vi.stubEnv('DEMO_MODE', 'true');
      expect(await saveLegalPageAction(null, form(legal()))).toMatchObject({ code: 'demo' });
      const empty = legal({ 'title.tr': '', 'title.en': '', 'body.tr': '', 'body.en': '' });
      expect(await saveLegalPageAction(null, form(empty))).toMatchObject({ code: 'demo' });
      expect(await getDb().legalPage.count()).toBe(0);
    });
  });

  describe('savePageMetadataAction', () => {
    it('saves the vision page info, which the public page reads', async () => {
      expect(await savePageMetadataAction(null, form(seo()))).toEqual({ status: 'success' });
      expect(await getPageMetadata('vision')).toMatchObject({ description: { tr: 'Açıklama', en: 'Description' } });
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('reports field errors and writes nothing', async () => {
      const result = await savePageMetadataAction(
        null,
        form(seo({ 'title.tr': '', 'description.en': 'x'.repeat(321) })),
      );
      expect(result).toEqual({
        status: 'error',
        code: 'invalid',
        fieldErrors: { 'title.tr': { code: 'required' }, 'description.en': { code: 'tooLong', max: 320 } },
      });
      expect(await getDb().pageMetadata.count()).toBe(0);
    });

    it('refuses an unknown page key, no session and demo mode', async () => {
      expect(await savePageMetadataAction(null, form(seo({ pageKey: 'dashboard' })))).toMatchObject({
        code: 'invalid',
      });
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
      expect(await savePageMetadataAction(null, form(seo()))).toMatchObject({ code: 'unauthorized' });
      mocks.guardAction.mockResolvedValue({ user: { email: 'admin@example.com' } });
      vi.stubEnv('DEMO_MODE', 'true');
      expect(await savePageMetadataAction(null, form(seo()))).toMatchObject({ code: 'demo' });
      expect(await getDb().pageMetadata.count()).toBe(0);
    });
  });
});
