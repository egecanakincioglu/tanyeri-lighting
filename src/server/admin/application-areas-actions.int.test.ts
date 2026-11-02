import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { listApplicationAreas } from '../content/application-areas.ts';
import {
  createApplicationAreaAction,
  deleteApplicationAreaAction,
  reorderApplicationAreasAction,
  updateApplicationAreaAction,
} from './application-areas-actions.ts';

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
  imageUrl: '/demo/area-konut.webp',
  'title.tr': `${name} alanı`,
  'title.en': name,
  'description.tr': 'Kısa açıklama.',
  'description.en': 'Short description.',
  ...extra,
});

async function titles(): Promise<string[]> {
  return (await listApplicationAreas()).map((item) => item.title.en);
}

describe('application area actions on a real database', () => {
  beforeEach(async () => {
    await getDb().applicationArea.deleteMany();
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

  it('creates an area and sends the browser to the list of the language', async () => {
    await expect(createApplicationAreaAction(null, form(valid('Homes', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/application-areas',
    );
    await expect(createApplicationAreaAction(null, form(valid('Offices', { locale: 'tr' })))).rejects.toThrow(
      'redirect:/tr/yonetim/calisma-alanlari',
    );
    expect(await titles()).toEqual(['Homes', 'Offices']);
  });

  it('reports the invalid fields and writes nothing', async () => {
    const result = await createApplicationAreaAction(null, form(valid('', { 'description.en': 'x'.repeat(301) })));
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: { 'title.en': { code: 'required' }, 'description.en': { code: 'tooLong', max: 300 } },
    });
    expect(await titles()).toEqual([]);
  });

  it('updates, deletes and reorders, and says not found for an area that is gone', async () => {
    for (const name of ['A', 'B', 'C']) {
      await expect(createApplicationAreaAction(null, form(valid(name)))).rejects.toThrow('redirect:');
    }
    const ids = (await listApplicationAreas()).map((item) => item.id);
    expect(await updateApplicationAreaAction(null, form(valid('A2', { id: ids[0]! })))).toEqual({ status: 'success' });
    expect(await reorderApplicationAreasAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['C', 'A2', 'B']);
    expect(await reorderApplicationAreasAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderApplicationAreasAction('nope' as unknown as string[])).toMatchObject({
      code: 'invalidOrder',
    });
    expect(await deleteApplicationAreaAction(null, form({ id: ids[1]! }))).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['C', 'A2']);
    expect(await updateApplicationAreaAction(null, form(valid('X', { id: 'gone' })))).toMatchObject({
      code: 'notFound',
    });
    expect(await deleteApplicationAreaAction(null, form({ id: 'gone' }))).toMatchObject({ code: 'notFound' });
  });

  describe('without a session and in the demo', () => {
    beforeEach(async () => {
      await expect(createApplicationAreaAction(null, form(valid('Homes')))).rejects.toThrow('redirect:');
    });

    async function everyAction() {
      const [item] = await listApplicationAreas();
      return [
        await createApplicationAreaAction(null, form(valid('Offices'))),
        await updateApplicationAreaAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteApplicationAreaAction(null, form({ id: item!.id })),
        await reorderApplicationAreasAction([item!.id]),
      ];
    }

    it('refuses every action for a visitor without a session', async () => {
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
      for (const result of await everyAction()) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await titles()).toEqual(['Homes']);
    });

    it('reads everything and writes nothing in the demo', async () => {
      vi.stubEnv('DEMO_MODE', 'true');
      for (const result of await everyAction()) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await titles()).toEqual(['Homes']);
    });
  });
});
