import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { listServices } from '../content/services.ts';
import {
  createServiceAction,
  deleteServiceAction,
  reorderServicesAction,
  updateServiceAction,
} from './services-actions.ts';

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

const valid = (title: string, extra: Record<string, string> = {}) => ({
  imageUrl: '/demo/area-otel.webp',
  'title.tr': `${title} hizmeti`,
  'title.en': title,
  'description.tr': '**Kısa** açıklama.',
  'description.en': '**Short** description.',
  'note.tr': '',
  'note.en': '',
  ...extra,
});

async function titles(): Promise<string[]> {
  return (await listServices()).map((item) => item.title.en);
}

describe('service actions on a real database', () => {
  beforeEach(async () => {
    await getDb().service.deleteMany();
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

  it('creates services without a note and sends the browser to the list of the language', async () => {
    await expect(createServiceAction(null, form(valid('Alpha', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/services',
    );
    await expect(createServiceAction(null, form(valid('Beta', { locale: 'tr' })))).rejects.toThrow(
      'redirect:/tr/yonetim/hizmetler',
    );
    expect(await titles()).toEqual(['Alpha', 'Beta']);
    expect((await listServices())[0]!.note).toEqual({ tr: '', en: '' });
  });

  it('stores a note filled in both languages', async () => {
    await expect(
      createServiceAction(null, form(valid('Alpha', { 'note.tr': 'Not', 'note.en': 'Note' }))),
    ).rejects.toThrow('redirect:');
    expect((await listServices())[0]!.note).toEqual({ tr: 'Not', en: 'Note' });
  });

  it('stores the image description from the form and reports a half-filled one', async () => {
    await expect(
      createServiceAction(null, form(valid('Alpha', { 'imageAlt.tr': 'Bir oda', 'imageAlt.en': 'A room' }))),
    ).rejects.toThrow('redirect:');
    expect((await listServices())[0]!.imageAlt).toEqual({ tr: 'Bir oda', en: 'A room' });
    const half = await createServiceAction(null, form(valid('Beta', { 'imageAlt.tr': 'Yalnız Türkçe' })));
    expect(half).toMatchObject({ status: 'error', code: 'invalid', fieldErrors: { imageAlt: { code: 'invalid' } } });
    expect(await listServices()).toHaveLength(1);
  });

  it('reports a note in one language only, and other invalid fields, and writes nothing', async () => {
    const half = await createServiceAction(null, form(valid('Alpha', { 'note.tr': 'Not' })));
    expect(half).toMatchObject({ status: 'error', code: 'invalid', fieldErrors: { note: { code: 'invalid' } } });
    const result = await createServiceAction(null, form(valid('', { 'title.tr': 'x'.repeat(101) })));
    expect(result).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: { 'title.en': { code: 'required' }, 'title.tr': { code: 'tooLong', max: 100 } },
    });
    expect(await titles()).toEqual([]);
  });

  it('updates a service, can clear its note, and redraws the screen', async () => {
    await expect(
      createServiceAction(null, form(valid('Alpha', { 'note.tr': 'Not', 'note.en': 'Note' }))),
    ).rejects.toThrow('redirect:');
    const [item] = await listServices();
    const result = await updateServiceAction(null, form(valid('Alpha 2', { id: item!.id })));
    expect(result).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['Alpha 2']);
    expect((await listServices())[0]!.note).toEqual({ tr: '', en: '' });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('says not found for a service that no longer exists', async () => {
    const result = await updateServiceAction(null, form(valid('Alpha', { id: 'missing' })));
    expect(result).toMatchObject({ status: 'error', code: 'notFound' });
    expect(await deleteServiceAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('deletes a service', async () => {
    await expect(createServiceAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    const [item] = await listServices();
    expect(await deleteServiceAction(null, form({ id: item!.id }))).toEqual({ status: 'success' });
    expect(await titles()).toEqual([]);
  });

  it('reorders the list, and refuses an order that is not the complete list', async () => {
    for (const title of ['A', 'B', 'C']) {
      await expect(createServiceAction(null, form(valid(title)))).rejects.toThrow('redirect:');
    }
    const ids = (await listServices()).map((item) => item.id);
    expect(await reorderServicesAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['C', 'A', 'B']);
    expect(await reorderServicesAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderServicesAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
    expect(await titles()).toEqual(['C', 'A', 'B']);
  });

  describe('without a session', () => {
    beforeEach(async () => {
      await expect(createServiceAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    });

    it('refuses every action and changes nothing', async () => {
      const [item] = await listServices();
      const results = [
        await createServiceAction(null, form(valid('Beta'))),
        await updateServiceAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteServiceAction(null, form({ id: item!.id })),
        await reorderServicesAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await titles()).toEqual(['Alpha']);
    });
  });

  describe('in demo mode', () => {
    beforeEach(async () => {
      await expect(createServiceAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('reads everything and writes nothing', async () => {
      const [item] = await listServices();
      const results = [
        await createServiceAction(null, form(valid('Beta'))),
        await updateServiceAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteServiceAction(null, form({ id: item!.id })),
        await reorderServicesAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await titles()).toEqual(['Alpha']);
    });
  });
});
