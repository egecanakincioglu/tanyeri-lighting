import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { listReferences } from '../content/references.ts';
import {
  createReferenceAction,
  deleteReferenceAction,
  reorderReferencesAction,
  updateReferenceAction,
} from './references-actions.ts';

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

const valid = (name: string, extra: Record<string, string> = {}) => ({
  imageUrl: '/demo/area-otel.webp',
  name,
  'title.tr': `${name} işi`,
  'title.en': `${name} work`,
  'description.tr': 'Kısa açıklama.',
  'description.en': 'Short description.',
  ...extra,
});

async function names(): Promise<string[]> {
  return (await listReferences()).map((item) => item.name);
}

describe('reference actions on a real database', () => {
  beforeEach(async () => {
    await getDb().reference.deleteMany();
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

  it('creates a reference and sends the browser to the list of the language', async () => {
    await expect(createReferenceAction(null, form(valid('Alpha', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/references',
    );
    await expect(createReferenceAction(null, form(valid('Beta', { locale: 'tr' })))).rejects.toThrow(
      'redirect:/tr/yonetim/referanslar',
    );
    expect(await names()).toEqual(['Alpha', 'Beta']);
  });

  it('falls back to the default language for an unknown locale field', async () => {
    await expect(createReferenceAction(null, form(valid('Alpha', { locale: 'xx' })))).rejects.toThrow(
      'redirect:/tr/yonetim/referanslar',
    );
  });

  it('reports the invalid fields and writes nothing', async () => {
    const result = await createReferenceAction(null, form(valid('', { 'title.en': 'x'.repeat(101) })));
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: { name: { code: 'required' }, 'title.en': { code: 'tooLong', max: 100 } },
    });
    expect(await names()).toEqual([]);
  });

  it('updates a reference and redraws the screen', async () => {
    await expect(createReferenceAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    const [item] = await listReferences();
    const result = await updateReferenceAction(null, form(valid('Alpha 2', { id: item!.id })));
    expect(result).toEqual({ status: 'success' });
    expect(await names()).toEqual(['Alpha 2']);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('says not found for a reference that no longer exists', async () => {
    const result = await updateReferenceAction(null, form(valid('Alpha', { id: 'missing' })));
    expect(result).toMatchObject({ status: 'error', code: 'notFound' });
    expect(await deleteReferenceAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('deletes a reference', async () => {
    await expect(createReferenceAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    const [item] = await listReferences();
    expect(await deleteReferenceAction(null, form({ id: item!.id }))).toEqual({ status: 'success' });
    expect(await names()).toEqual([]);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('reorders the list, and refuses an order that is not the complete list', async () => {
    for (const name of ['A', 'B', 'C']) {
      await expect(createReferenceAction(null, form(valid(name)))).rejects.toThrow('redirect:');
    }
    const ids = (await listReferences()).map((item) => item.id);
    expect(await reorderReferencesAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await names()).toEqual(['C', 'A', 'B']);
    expect(await reorderReferencesAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderReferencesAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
    expect(await names()).toEqual(['C', 'A', 'B']);
  });

  describe('without a session', () => {
    beforeEach(async () => {
      await expect(createReferenceAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    });

    it('refuses every action and changes nothing', async () => {
      const [item] = await listReferences();
      const results = [
        await createReferenceAction(null, form(valid('Beta'))),
        await updateReferenceAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteReferenceAction(null, form({ id: item!.id })),
        await reorderReferencesAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await names()).toEqual(['Alpha']);
    });
  });

  describe('in demo mode', () => {
    beforeEach(async () => {
      await expect(createReferenceAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('reads everything and writes nothing', async () => {
      const [item] = await listReferences();
      const results = [
        await createReferenceAction(null, form(valid('Beta'))),
        await updateReferenceAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteReferenceAction(null, form({ id: item!.id })),
        await reorderReferencesAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await names()).toEqual(['Alpha']);
    });
  });
});
