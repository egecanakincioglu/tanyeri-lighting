import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { listProjects } from '../content/projects.ts';
import {
  createProjectAction,
  deleteProjectAction,
  reorderProjectsAction,
  updateProjectAction,
} from './projects-actions.ts';

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
  'title.tr': `${title} projesi`,
  'title.en': title,
  'description.tr': 'Kısa açıklama.',
  'description.en': 'Short description.',
  beforeImageUrl: '/demo/area-otel.webp',
  afterImageUrl: '/demo/area-otel.webp',
  ...extra,
});

async function titles(): Promise<string[]> {
  return (await listProjects()).map((item) => item.title.en);
}

describe('project actions on a real database', () => {
  beforeEach(async () => {
    await getDb().project.deleteMany();
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

  it('creates a project with both pictures and sends the browser to the list of the language', async () => {
    await expect(createProjectAction(null, form(valid('Alpha', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/projects',
    );
    await expect(
      createProjectAction(null, form(valid('Beta', { locale: 'tr', afterImageUrl: '/demo/area-ofis.webp' }))),
    ).rejects.toThrow('redirect:/tr/yonetim/projeler');
    expect(await titles()).toEqual(['Alpha', 'Beta']);
    expect((await listProjects())[1]!.afterImageUrl).toBe('/demo/area-ofis.webp');
  });

  it('reports the invalid fields, a missing picture included, and writes nothing', async () => {
    const result = await createProjectAction(null, form(valid('', { beforeImageUrl: '' })));
    expect(result).toMatchObject({
      status: 'error',
      code: 'invalid',
      fieldErrors: { 'title.en': { code: 'required' }, beforeImageUrl: expect.any(Object) },
    });
    expect(await titles()).toEqual([]);
  });

  it('updates a project and redraws the screen', async () => {
    await expect(createProjectAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    const [item] = await listProjects();
    const result = await updateProjectAction(null, form(valid('Alpha 2', { id: item!.id })));
    expect(result).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['Alpha 2']);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('says not found for a project that no longer exists', async () => {
    const result = await updateProjectAction(null, form(valid('Alpha', { id: 'missing' })));
    expect(result).toMatchObject({ status: 'error', code: 'notFound' });
    expect(await deleteProjectAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('deletes a project', async () => {
    await expect(createProjectAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
    const [item] = await listProjects();
    expect(await deleteProjectAction(null, form({ id: item!.id }))).toEqual({ status: 'success' });
    expect(await titles()).toEqual([]);
  });

  it('reorders the list, and refuses an order that is not the complete list', async () => {
    for (const title of ['A', 'B', 'C']) {
      await expect(createProjectAction(null, form(valid(title)))).rejects.toThrow('redirect:');
    }
    const ids = (await listProjects()).map((item) => item.id);
    expect(await reorderProjectsAction([ids[2]!, ids[0]!, ids[1]!])).toEqual({ status: 'success' });
    expect(await titles()).toEqual(['C', 'A', 'B']);
    expect(await reorderProjectsAction([ids[0]!])).toMatchObject({ code: 'invalidOrder' });
    expect(await reorderProjectsAction('nope' as unknown as string[])).toMatchObject({ code: 'invalidOrder' });
    expect(await titles()).toEqual(['C', 'A', 'B']);
  });

  describe('without a session', () => {
    beforeEach(async () => {
      await expect(createProjectAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    });

    it('refuses every action and changes nothing', async () => {
      const [item] = await listProjects();
      const results = [
        await createProjectAction(null, form(valid('Beta'))),
        await updateProjectAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteProjectAction(null, form({ id: item!.id })),
        await reorderProjectsAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await titles()).toEqual(['Alpha']);
    });
  });

  describe('in demo mode', () => {
    beforeEach(async () => {
      await expect(createProjectAction(null, form(valid('Alpha')))).rejects.toThrow('redirect:');
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('reads everything and writes nothing', async () => {
      const [item] = await listProjects();
      const results = [
        await createProjectAction(null, form(valid('Beta'))),
        await updateProjectAction(null, form(valid('Changed', { id: item!.id }))),
        await deleteProjectAction(null, form({ id: item!.id })),
        await reorderProjectsAction([item!.id]),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await titles()).toEqual(['Alpha']);
    });
  });
});
