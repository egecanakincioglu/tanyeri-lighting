import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { createCatalog } from '../content/catalogs.ts';
import { listPromoBoards } from '../content/promo-boards.ts';
import {
  createPromoBoardAction,
  deletePromoBoardAction,
  reorderPromoBoardsAction,
  updatePromoBoardAction,
} from './promo-boards-actions.ts';

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

async function titles(): Promise<string[]> {
  return (await listPromoBoards()).map((item) => item.title.en);
}

describe('promo board actions on a real database', () => {
  let catalogId = '';
  const valid = (name: string, extra: Record<string, string> = {}) => ({
    imageUrl: '/demo/promo-yasam.webp',
    'title.tr': `${name} başlık`,
    'title.en': name,
    'subtitle.tr': 'Kısa satır',
    'subtitle.en': 'Short line',
    catalogId,
    ...extra,
  });

  beforeEach(async () => {
    await getDb().promoBoard.deleteMany();
    await getDb().catalog.deleteMany();
    catalogId = (
      await createCatalog({
        name: { tr: 'Genel', en: 'General' },
        pdfUrl: 'https://store.example.com/general.pdf',
        coverImageUrl: '',
        imageAlt: { tr: '', en: '' },
        sizeBytes: 1000,
      })
    ).id;
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

  it('creates a board with an empty or filled subtitle and sends the browser to the list of the language', async () => {
    await expect(createPromoBoardAction(null, form(valid('Alpha', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/promo-boards',
    );
    await expect(
      createPromoBoardAction(null, form(valid('Beta', { locale: 'tr', 'subtitle.tr': '', 'subtitle.en': '' }))),
    ).rejects.toThrow('redirect:/tr/yonetim/tanitim-panolari');
    expect(await titles()).toEqual(['Alpha', 'Beta']);
    expect((await listPromoBoards())[1]?.subtitle).toEqual({ tr: '', en: '' });
  });

  it('stores the image description from the form and reports a half-filled one', async () => {
    await expect(
      createPromoBoardAction(null, form(valid('Alpha', { 'imageAlt.tr': 'Bir oda', 'imageAlt.en': 'A room' }))),
    ).rejects.toThrow('redirect:');
    expect((await listPromoBoards())[0]!.imageAlt).toEqual({ tr: 'Bir oda', en: 'A room' });
    const half = await createPromoBoardAction(null, form(valid('Beta', { 'imageAlt.tr': 'Yalnız Türkçe' })));
    expect(half).toMatchObject({ status: 'error', code: 'invalid', fieldErrors: { imageAlt: { code: 'invalid' } } });
    expect(await listPromoBoards()).toHaveLength(1);
  });

  it('reports the invalid fields and writes nothing', async () => {
    const result = await createPromoBoardAction(null, form(valid('', { 'subtitle.en': '', catalogId: '' })));
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: {
        'title.en': { code: 'required' },
        subtitle: { code: 'invalid' },
        catalogId: { code: 'required' },
      },
    });
    expect(await titles()).toEqual([]);
  });

  it('says not found for a catalog that does not exist', async () => {
    const result = await createPromoBoardAction(null, form(valid('Alpha', { catalogId: 'missing' })));
    expect(result).toMatchObject({ status: 'error', code: 'notFound' });
  });

  it('updates, deletes and reorders, and says not found for a board that is gone', async () => {
    for (const name of ['A', 'B', 'C']) {
      await expect(createPromoBoardAction(null, form(valid(name)))).rejects.toThrow('redirect:');
    }
    const ids = (await listPromoBoards()).map((item) => item.id);
    expect(await updatePromoBoardAction(null, form(valid('A2', { id: ids[0]! })))).toEqual({ status: 'success' });
    expect(await reorderPromoBoardsAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['C', 'A2', 'B']);
    expect(await reorderPromoBoardsAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderPromoBoardsAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
    expect(await deletePromoBoardAction(null, form({ id: ids[1]! }))).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['C', 'A2']);
    expect(await updatePromoBoardAction(null, form(valid('X', { id: 'gone' })))).toMatchObject({ code: 'notFound' });
    expect(await deletePromoBoardAction(null, form({ id: 'gone' }))).toMatchObject({ code: 'notFound' });
  });

  describe('without a session and in the demo', () => {
    beforeEach(async () => {
      await expect(createPromoBoardAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    });

    async function everyAction() {
      const [item] = await listPromoBoards();
      return [
        await createPromoBoardAction(null, form(valid('Beta'))),
        await updatePromoBoardAction(null, form(valid('Changed', { id: item!.id }))),
        await deletePromoBoardAction(null, form({ id: item!.id })),
        await reorderPromoBoardsAction([item!.id]),
      ];
    }

    it('refuses every action for a visitor without a session', async () => {
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
      for (const result of await everyAction()) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await titles()).toEqual(['Alpha']);
    });

    it('reads everything and writes nothing in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      for (const result of await everyAction()) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await titles()).toEqual(['Alpha']);
    });
  });
});
