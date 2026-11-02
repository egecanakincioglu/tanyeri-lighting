import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { getPublishedPostBySlug, listPosts } from '../content/blog.ts';
import { createPostAction, deletePostAction, updatePostAction } from './blog-actions.ts';

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

const valid = (slug: string, extra: Record<string, string> = {}) => ({
  slug,
  imageUrl: '/demo/product-bahce.webp',
  'title.tr': `${slug} başlık`,
  'title.en': `${slug} title`,
  'description.tr': 'Açıklama',
  'description.en': 'Description',
  'excerpt.tr': 'Özet',
  'excerpt.en': 'Excerpt',
  'body.tr': '## Bölüm\n\n**Metin**',
  'body.en': '## Section\n\n**Text**',
  'imageAlt.tr': 'Görsel',
  'imageAlt.en': 'Picture',
  publishedAt: '2026-03-01',
  ...extra,
});

async function slugs(): Promise<string[]> {
  return (await listPosts()).map((item) => item.slug).sort();
}

describe('blog actions on a real database', () => {
  beforeEach(async () => {
    await getDb().blogPost.deleteMany();
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

  it('creates a post and sends the browser to the list of the language', async () => {
    await expect(createPostAction(null, form(valid('one', { locale: 'en' })))).rejects.toThrow(
      'redirect:/en/admin/blog',
    );
    await expect(createPostAction(null, form(valid('two', { locale: 'tr' })))).rejects.toThrow(
      'redirect:/tr/yonetim/blog',
    );
    expect(await slugs()).toEqual(['one', 'two']);
    expect((await getPublishedPostBySlug('one'))?.publishedAt).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('keeps a post without a date as a draft', async () => {
    await expect(createPostAction(null, form(valid('draft', { publishedAt: '' })))).rejects.toThrow('redirect:');
    expect(await getPublishedPostBySlug('draft')).toBeNull();
    expect(await slugs()).toEqual(['draft']);
  });

  it('reports invalid fields, a bad date and a taken slug, and writes nothing more', async () => {
    const invalid = await createPostAction(
      null,
      form(valid('Bad Slug', { 'title.en': '', 'title.tr': 'x'.repeat(121), publishedAt: '1 March' })),
    );
    expect(invalid).toEqual({
      status: 'error',
      code: 'invalid',
      fieldErrors: {
        slug: { code: 'invalid' },
        'title.tr': { code: 'tooLong', max: 120 },
        'title.en': { code: 'required' },
        publishedAt: { code: 'invalid' },
      },
    });
    expect(await slugs()).toEqual([]);
    await expect(createPostAction(null, form(valid('one')))).rejects.toThrow('redirect:');
    expect(await createPostAction(null, form(valid('one')))).toEqual({
      status: 'error',
      code: 'taken',
      fieldErrors: { slug: { code: 'taken' } },
    });
  });

  it('updates a post, can turn it into a draft, and redraws the screen', async () => {
    await expect(createPostAction(null, form(valid('one')))).rejects.toThrow('redirect:');
    const [item] = await listPosts();
    const result = await updatePostAction(null, form(valid('one', { id: item!.id, 'title.en': 'Changed' })));
    expect(result).toEqual({ status: 'success' });
    expect((await getPublishedPostBySlug('one'))?.title.en).toBe('Changed');
    await updatePostAction(null, form(valid('one', { id: item!.id, publishedAt: '' })));
    expect(await getPublishedPostBySlug('one')).toBeNull();
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });

  it('says not found for a post that no longer exists', async () => {
    expect(await updatePostAction(null, form(valid('one', { id: 'missing' })))).toMatchObject({ code: 'notFound' });
    expect(await deletePostAction(null, form({ id: 'missing' }))).toMatchObject({ code: 'notFound' });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('deletes a post', async () => {
    await expect(createPostAction(null, form(valid('one')))).rejects.toThrow('redirect:');
    const [item] = await listPosts();
    expect(await deletePostAction(null, form({ id: item!.id }))).toEqual({ status: 'success' });
    expect(await slugs()).toEqual([]);
  });

  describe('without a session', () => {
    beforeEach(async () => {
      await expect(createPostAction(null, form(valid('one')))).rejects.toThrow('redirect:');
      const { UnauthorizedError } = await import('../auth/guard.ts');
      mocks.guardAction.mockRejectedValue(new UnauthorizedError());
    });

    it('refuses every action and changes nothing', async () => {
      const [item] = await listPosts();
      const results = [
        await createPostAction(null, form(valid('two'))),
        await updatePostAction(null, form(valid('one', { id: item!.id, 'title.en': 'Changed' }))),
        await deletePostAction(null, form({ id: item!.id })),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'unauthorized' });
      expect(await slugs()).toEqual(['one']);
      expect((await getPublishedPostBySlug('one'))?.title.en).toBe('one title');
    });
  });

  describe('in demo mode', () => {
    beforeEach(async () => {
      await expect(createPostAction(null, form(valid('one')))).rejects.toThrow('redirect:');
      vi.stubEnv('DEMO_MODE', 'true');
    });

    it('reads everything and writes nothing', async () => {
      const [item] = await listPosts();
      const results = [
        await createPostAction(null, form(valid('two'))),
        await updatePostAction(null, form(valid('one', { id: item!.id, 'title.en': 'Changed' }))),
        await deletePostAction(null, form({ id: item!.id })),
      ];
      for (const result of results) expect(result).toMatchObject({ status: 'error', code: 'demo' });
      expect(await slugs()).toEqual(['one']);
    });
  });
});
