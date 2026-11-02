import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAboutPage } from '../content/about-page.ts';
import { getSiteSettings } from '../content/site-settings.ts';
import { listSocialLinks } from '../content/social-links.ts';
import { getDb } from '../db.ts';
import {
  createSocialLinkAction,
  deleteSocialLinkAction,
  reorderSocialLinksAction,
  updateAboutPageAction,
  updateSiteSettingsAction,
  updateSocialLinkAction,
} from './corporate-actions.ts';

const mocks = vi.hoisted(() => ({ guardAction: vi.fn(), refresh: vi.fn() }));

vi.mock('../auth/guard.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/guard.ts')>()),
  guardAction: mocks.guardAction,
}));
vi.mock('next/cache', () => ({ refresh: mocks.refresh }));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

const settings = (extra: Record<string, string> = {}) => ({
  logoUrl: '',
  'siteName.tr': 'Tanyeri Aydınlatma',
  'siteName.en': 'Tanyeri Lighting',
  phone: '+90 212 000 00 00',
  email: 'info@example.com',
  'address.tr': 'Örnek Mahallesi 1',
  'address.en': 'Example District 1',
  'workingHours.tr': 'Pazartesi - Cuma 09:00 - 18:00',
  'workingHours.en': 'Monday - Friday 09:00 - 18:00',
  'serviceArea.tr': 'Türkiye geneli',
  'serviceArea.en': 'All over Turkey',
  'languages.tr': 'Türkçe, İngilizce',
  'languages.en': 'Turkish, English',
  ...extra,
});

const link = (platform: string, extra: Record<string, string> = {}) => ({
  platform,
  'label.tr': `${platform} sayfamız`,
  'label.en': `Our ${platform} page`,
  url: `https://example.com/${platform}`,
  ...extra,
});

const about = (extra: Record<string, string> = {}) => ({
  'body.tr': 'Hakkımızda **metni**',
  'body.en': 'About **text**',
  'vision.tr': 'Vizyon metni',
  'vision.en': 'Vision text',
  ...extra,
});

async function platforms(): Promise<string[]> {
  return (await listSocialLinks()).map((item) => item.platform);
}

describe('company actions on a real database', () => {
  beforeEach(async () => {
    await getDb().socialLink.deleteMany();
    await getDb().siteSettings.deleteMany();
    await getDb().aboutPage.deleteMany();
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

  describe('site settings', () => {
    it('saves every field, a logo included, and redraws the screen', async () => {
      const result = await updateSiteSettingsAction(null, form(settings({ logoUrl: '/demo/area-otel.webp' })));
      expect(result).toEqual({ status: 'success' });
      expect(await getSiteSettings()).toMatchObject({
        siteName: { tr: 'Tanyeri Aydınlatma', en: 'Tanyeri Lighting' },
        logoUrl: '/demo/area-otel.webp',
        phone: '+90 212 000 00 00',
        email: 'info@example.com',
      });
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('stores an empty logo field as no logo', async () => {
      await updateSiteSettingsAction(null, form(settings({ logoUrl: '/demo/area-otel.webp' })));
      await updateSiteSettingsAction(null, form(settings()));
      expect((await getSiteSettings()).logoUrl).toBeNull();
    });

    it('reports each invalid field and writes nothing', async () => {
      const result = await updateSiteSettingsAction(
        null,
        form(settings({ email: 'not-an-address', phone: '12', 'siteName.en': '', 'address.tr': 'x'.repeat(301) })),
      );
      expect(result).toEqual({
        status: 'error',
        code: 'invalid',
        fieldErrors: {
          'siteName.en': { code: 'required' },
          phone: { code: 'invalid' },
          email: { code: 'invalid' },
          'address.tr': { code: 'tooLong', max: 300 },
        },
      });
      expect((await getSiteSettings()).email).toBe('');
      expect(mocks.refresh).not.toHaveBeenCalled();
    });
  });

  describe('social links', () => {
    it('adds links to the end, edits one and deletes one', async () => {
      expect(await createSocialLinkAction(null, form(link('instagram')))).toEqual({ status: 'success' });
      expect(await createSocialLinkAction(null, form(link('facebook')))).toEqual({ status: 'success' });
      expect(await platforms()).toEqual(['instagram', 'facebook']);
      const [first, second] = await listSocialLinks();
      expect(await updateSocialLinkAction(null, form(link('x', { id: first!.id })))).toEqual({ status: 'success' });
      expect(await platforms()).toEqual(['x', 'facebook']);
      expect(await deleteSocialLinkAction(null, form({ id: second!.id }))).toEqual({ status: 'success' });
      expect(await platforms()).toEqual(['x']);
      expect(mocks.refresh).toHaveBeenCalledTimes(4);
    });

    it('reports the invalid fields of a link', async () => {
      const result = await createSocialLinkAction(null, form(link('', { url: 'http://example.com', 'label.en': '' })));
      expect(result).toEqual({
        status: 'error',
        code: 'invalid',
        fieldErrors: { platform: { code: 'required' }, 'label.en': { code: 'required' }, url: { code: 'invalid' } },
      });
      expect(await platforms()).toEqual([]);
    });

    it('says not found for a link that no longer exists', async () => {
      expect(await updateSocialLinkAction(null, form(link('x', { id: 'missing' })))).toMatchObject({
        code: 'notFound',
      });
      expect(await deleteSocialLinkAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
    });

    it('reorders the list, and refuses an order that is not the complete list', async () => {
      for (const name of ['a', 'b', 'c']) await createSocialLinkAction(null, form(link(name)));
      const ids = (await listSocialLinks()).map((item) => item.id);
      expect(await reorderSocialLinksAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
      expect(await platforms()).toEqual(['c', 'a', 'b']);
      expect(await reorderSocialLinksAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
      expect(await reorderSocialLinksAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
      expect(await platforms()).toEqual(['c', 'a', 'b']);
    });
  });

  describe('about page', () => {
    it('saves both texts in both languages', async () => {
      expect(await updateAboutPageAction(null, form(about()))).toEqual({ status: 'success' });
      expect(await getAboutPage()).toEqual({
        body: { tr: 'Hakkımızda **metni**', en: 'About **text**' },
        vision: { tr: 'Vizyon metni', en: 'Vision text' },
      });
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it('reports the invalid fields and writes nothing', async () => {
      const result = await updateAboutPageAction(null, form(about({ 'vision.tr': '', 'body.en': 'x'.repeat(50_001) })));
      expect(result).toEqual({
        status: 'error',
        code: 'invalid',
        fieldErrors: { 'body.en': { code: 'tooLong', max: 50_000 }, 'vision.tr': { code: 'required' } },
      });
      expect((await getAboutPage()).body.tr).toBe('');
    });
  });

  describe('without a session', () => {
    it('refuses every action and changes nothing', async () => {
      await createSocialLinkAction(null, form(link('instagram')));
      const [item] = await listSocialLinks();
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
      const results = [
        await updateSiteSettingsAction(null, form(settings())),
        await createSocialLinkAction(null, form(link('facebook'))),
        await updateSocialLinkAction(null, form(link('x', { id: item!.id }))),
        await deleteSocialLinkAction(null, form({ id: item!.id })),
        await reorderSocialLinksAction([item!.id]),
        await updateAboutPageAction(null, form(about())),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await platforms()).toEqual(['instagram']);
      expect((await getSiteSettings()).email).toBe('');
      expect((await getAboutPage()).body.tr).toBe('');
    });
  });

  describe('in demo mode', () => {
    it('reads everything and writes nothing', async () => {
      await createSocialLinkAction(null, form(link('instagram')));
      const [item] = await listSocialLinks();
      vi.stubEnv('DEMO_MODE', 'true');
      const results = [
        await updateSiteSettingsAction(null, form(settings())),
        await createSocialLinkAction(null, form(link('facebook'))),
        await updateSocialLinkAction(null, form(link('x', { id: item!.id }))),
        await deleteSocialLinkAction(null, form({ id: item!.id })),
        await reorderSocialLinksAction([item!.id]),
        await updateAboutPageAction(null, form(about())),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await platforms()).toEqual(['instagram']);
      expect((await getSiteSettings()).email).toBe('');
    });
  });
});
