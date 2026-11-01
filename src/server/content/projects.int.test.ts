import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import { ContentNotFoundError, InvalidOrderError } from './errors.ts';
import { createProject, deleteProject, getProject, listProjects, reorderProjects, updateProject } from './projects.ts';

const pair = (tr: string, en: string) => ({ tr, en });

function project(name: string) {
  return {
    title: pair(`${name} TR`, `${name} EN`),
    description: pair(`## ${name}\n\nAçıklama.`, `## ${name}\n\nDescription.`),
    beforeImageUrl: `https://store.example.com/${name.toLowerCase()}-before.webp`,
    afterImageUrl: `https://store.example.com/${name.toLowerCase()}-after.webp`,
  };
}

async function titles(): Promise<string[]> {
  return (await listProjects()).map((item) => item.title.en);
}

describe('projects on a real database', () => {
  beforeEach(async () => {
    await getDb().project.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('starts with an empty list', async () => {
    expect(await listProjects()).toEqual([]);
  });

  it('creates projects at the end of the list and lists them in that order', async () => {
    const first = await createProject(project('Villa'));
    await createProject(project('Office'));
    await createProject(project('Shop'));
    expect(first).toEqual({ id: expect.any(String), ...project('Villa') });
    expect(await titles()).toEqual(['Villa EN', 'Office EN', 'Shop EN']);
  });

  it('maps each language to its own column', async () => {
    await createProject(project('Villa'));
    const row = await getDb().project.findFirstOrThrow();
    expect(row).toMatchObject({
      titleTr: 'Villa TR',
      titleEn: 'Villa EN',
      descriptionTr: '## Villa\n\nAçıklama.',
      descriptionEn: '## Villa\n\nDescription.',
    });
  });

  it('gets a project by id and answers null for an unknown one', async () => {
    const created = await createProject(project('Villa'));
    await createProject(project('Office'));
    expect(await getProject(created.id)).toEqual(created);
    expect(await getProject('missing')).toBeNull();
    await expect(getProject('')).rejects.toThrow();
  });

  it('updates a project without moving it', async () => {
    await createProject(project('Villa'));
    const second = await createProject(project('Office'));
    await createProject(project('Shop'));
    const updated = await updateProject(second.id, { ...project('Office'), title: pair('Yeni', 'New') });
    expect(updated).toEqual({ id: second.id, ...project('Office'), title: pair('Yeni', 'New') });
    expect(await titles()).toEqual(['Villa EN', 'New', 'Shop EN']);
  });

  it('deletes a project and keeps the order of the others', async () => {
    await createProject(project('Villa'));
    const second = await createProject(project('Office'));
    await createProject(project('Shop'));
    await deleteProject(second.id);
    expect(await titles()).toEqual(['Villa EN', 'Shop EN']);
    await createProject(project('Hotel'));
    expect(await titles()).toEqual(['Villa EN', 'Shop EN', 'Hotel EN']);
  });

  it('reorders the list', async () => {
    const a = await createProject(project('Villa'));
    const b = await createProject(project('Office'));
    const c = await createProject(project('Shop'));
    await reorderProjects([c.id, a.id, b.id]);
    expect(await titles()).toEqual(['Shop EN', 'Villa EN', 'Office EN']);
    await reorderProjects([b.id, c.id, a.id]);
    expect(await titles()).toEqual(['Office EN', 'Shop EN', 'Villa EN']);
  });

  it('reports a missing project on update and delete', async () => {
    await expect(updateProject('missing', project('Villa'))).rejects.toThrow(ContentNotFoundError);
    await expect(deleteProject('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it.each([
    ['an id that is left out', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), 'missing']],
    ['a repeated id', (ids: string[]) => [ids[0], ids[0], ids[1]]],
    ['an extra id', (ids: string[]) => [...ids, 'extra']],
  ])('rejects a new order with %s and changes nothing', async (_, build) => {
    const a = await createProject(project('Villa'));
    const b = await createProject(project('Office'));
    const c = await createProject(project('Shop'));
    await expect(reorderProjects(build([a.id, b.id, c.id]))).rejects.toThrow(InvalidOrderError);
    expect(await titles()).toEqual(['Villa EN', 'Office EN', 'Shop EN']);
  });

  it('accepts an empty order for an empty list', async () => {
    await expect(reorderProjects([])).resolves.toBeUndefined();
  });

  it('rejects a missing language, a non-https address and bad ids, and stores nothing', async () => {
    await expect(createProject({ ...project('Villa'), title: { tr: 'Villa' } })).rejects.toThrow();
    await expect(createProject({ ...project('Villa'), description: pair('Metin', ' ') })).rejects.toThrow();
    await expect(createProject({ ...project('Villa'), beforeImageUrl: 'http://example.com/a.webp' })).rejects.toThrow();
    await expect(createProject({ ...project('Villa'), afterImageUrl: 'javascript:alert(1)' })).rejects.toThrow();
    await expect(reorderProjects('not a list')).rejects.toThrow();
    await expect(deleteProject('')).rejects.toThrow();
    expect(await listProjects()).toEqual([]);
  });

  it('rejects an invalid update and keeps the stored project', async () => {
    const created = await createProject(project('Villa'));
    await expect(updateProject(created.id, { ...project('Villa'), title: pair('Yeni', '') })).rejects.toThrow();
    await expect(
      updateProject(created.id, { ...project('Villa'), afterImageUrl: 'http://example.com/a.webp' }),
    ).rejects.toThrow();
    expect(await listProjects()).toEqual([created]);
  });

  it('refuses every write in demo mode and changes nothing', async () => {
    const a = await createProject(project('Villa'));
    const b = await createProject(project('Office'));
    const before = await listProjects();
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createProject(project('Shop'))).rejects.toThrow(DemoModeError);
    await expect(updateProject(a.id, project('Shop'))).rejects.toThrow(DemoModeError);
    await expect(deleteProject(a.id)).rejects.toThrow(DemoModeError);
    await expect(reorderProjects([b.id, a.id])).rejects.toThrow(DemoModeError);
    await expect(createProject({})).rejects.toThrow(DemoModeError);
    expect(await listProjects()).toEqual(before);
    expect(await getProject(a.id)).toEqual(a);
  });
});
