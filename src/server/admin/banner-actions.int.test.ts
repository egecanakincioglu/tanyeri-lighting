import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { getHomeBanner } from '../content/home-banner.ts';
import { updateBannerAction } from './banner-actions.ts';

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

const valid = (title: string, extra: Record<string, string> = {}) => ({
  imageUrl: '/demo/banner.webp',
  'title.tr': `${title} başlık`,
  'title.en': `${title} title`,
  'description.tr': 'Kısa açıklama.',
  'description.en': 'Short description.',
  'primaryLabel.tr': 'Ürünler',
  'primaryLabel.en': 'Products',
  primaryTarget: 'products',
  'secondaryLabel.tr': 'İletişim',
  'secondaryLabel.en': 'Contact',
  secondaryTarget: 'contact',
  ...extra,
});

describe('banner action on a real database', () => {
  beforeEach(async () => {
    await getDb().homeBanner.deleteMany();
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

  it('saves the whole banner and redraws the screen', async () => {
    expect(await updateBannerAction(null, form(valid('First')))).toEqual({ status: 'success' });
    expect(await updateBannerAction(null, form(valid('Second', { secondaryTarget: 'catalogs' })))).toEqual({
      status: 'success',
    });
    const banner = await getHomeBanner();
    expect(banner.title.en).toBe('Second title');
    expect(banner.primaryAction).toEqual({ label: { tr: 'Ürünler', en: 'Products' }, target: 'products' });
    expect(banner.secondaryAction.target).toBe('catalogs');
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it('reports the invalid fields, including the buttons, and writes nothing', async () => {
    const result = await updateBannerAction(
      null,
      form(valid('Bad', { 'primaryLabel.en': '', secondaryTarget: 'nowhere', 'title.tr': 'x'.repeat(121) })),
    );
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: {
        'title.tr': { code: 'tooLong', max: 120 },
        'primaryAction.label.en': { code: 'required' },
        'secondaryAction.target': { code: 'invalid' },
      },
    });
    expect(await getDb().homeBanner.count()).toBe(0);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('refuses a visitor without a session and changes nothing', async () => {
    const { UnauthorizedError } = await import('../auth/guard.ts');
    mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    expect(await updateBannerAction(null, form(valid('Nope')))).toMatchObject({
      status: 'error',
      code: 'unauthorized',
    });
    expect(await getDb().homeBanner.count()).toBe(0);
  });

  it('reads and writes nothing in the demo', async () => {
    vi.stubEnv('DEMO_MODE', 'true');
    expect(await updateBannerAction(null, form(valid('Nope')))).toMatchObject({ status: 'error', code: 'demo' });
    expect(await getDb().homeBanner.count()).toBe(0);
  });
});
