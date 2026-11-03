import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb } from '../db.ts';
import { DemoModeError } from '../demo/guard.ts';
import {
  createPost,
  deletePost,
  getPost,
  getPublishedPostBySlug,
  getPublishedPostRedirect,
  listOtherPosts,
  listPostChanges,
  listPosts,
  listPublishedPosts,
  updatePost,
} from './blog.ts';
import { ContentNotFoundError, ValueTakenError } from './errors.ts';

const pair = (tr: string, en: string) => ({ tr, en });
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function post(slug: string, publishedAt: Date | null = day('2026-03-01')) {
  return {
    slug,
    title: pair(`${slug} başlık`, `${slug} title`),
    description: pair('Açıklama', 'Description'),
    excerpt: pair('Özet', 'Excerpt'),
    body: pair('## Bölüm\n\nMetin.', '## Section\n\nText.'),
    imageUrl: `https://store.example.com/${slug}.webp`,
    imageAlt: pair('Görsel', 'Picture'),
    publishedAt,
  };
}

describe('blog posts on a real database', () => {
  beforeEach(async () => {
    await getDb().blogPost.deleteMany();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await getDb().$disconnect();
  });

  it('maps each language to its own column and reads the post back', async () => {
    const created = await createPost(post('one'));
    expect(created).toMatchObject({
      slug: 'one',
      title: pair('one başlık', 'one title'),
      publishedAt: day('2026-03-01'),
    });
    expect(await getDb().blogPost.findFirstOrThrow()).toMatchObject({
      titleTr: 'one başlık',
      titleEn: 'one title',
      bodyEn: '## Section\n\nText.',
      imageAltTr: 'Görsel',
    });
    expect(await getPost(created.id)).toEqual(created);
    expect(await getPost('missing')).toBeNull();
  });

  it('lists the published posts newest first, without bodies', async () => {
    await createPost(post('old', day('2026-01-01')));
    await createPost(post('new', day('2026-05-01')));
    await createPost(post('mid', day('2026-03-01')));
    const list = await listPublishedPosts();
    expect(list.map((item) => item.slug)).toEqual(['new', 'mid', 'old']);
    expect(list[0]).not.toHaveProperty('body');
  });

  it('keeps drafts and future posts out of every public read', async () => {
    await createPost(post('live'));
    const draft = await createPost(post('draft', null));
    await createPost(post('later', new Date(Date.now() + 86_400_000)));
    expect((await listPublishedPosts()).map((item) => item.slug)).toEqual(['live']);
    expect((await listPostChanges()).map((item) => item.slug)).toEqual(['live']);
    expect((await listOtherPosts('none', 5)).map((item) => item.slug)).toEqual(['live']);
    expect(await getPublishedPostBySlug('draft')).toBeNull();
    expect(await getPublishedPostBySlug('later')).toBeNull();
    expect(await getPublishedPostBySlug('live')).toMatchObject({ slug: 'live' });
    expect((await getPost(draft.id))?.slug).toBe('draft');
  });

  it('lists drafts first in the panel list', async () => {
    await createPost(post('live'));
    await createPost(post('draft', null));
    expect((await listPosts()).map((item) => item.slug)).toEqual(['draft', 'live']);
  });

  it('leaves out the post itself and honours the limit in the other posts', async () => {
    await createPost(post('a', day('2026-01-01')));
    await createPost(post('b', day('2026-02-01')));
    await createPost(post('c', day('2026-03-01')));
    expect((await listOtherPosts('c', 2)).map((item) => item.slug)).toEqual(['b', 'a']);
    expect((await listOtherPosts('a', 1)).map((item) => item.slug)).toEqual(['c']);
  });

  it('publishes a draft and unpublishes a post by changing the date', async () => {
    const draft = await createPost(post('draft', null));
    await updatePost(draft.id, post('draft', day('2026-04-01')));
    expect(await getPublishedPostBySlug('draft')).not.toBeNull();
    await updatePost(draft.id, post('draft', null));
    expect(await getPublishedPostBySlug('draft')).toBeNull();
  });

  it('accepts only kebab-case slugs', async () => {
    for (const slug of ['Upper', 'two words', 'trailing-', '-leading', 'double--hyphen', 'çay', '']) {
      await expect(createPost(post(slug))).rejects.toThrow();
    }
    expect(await getDb().blogPost.count()).toBe(0);
  });

  it('refuses a slug that is taken, on create and on update', async () => {
    await createPost(post('one'));
    const two = await createPost(post('two'));
    await expect(createPost(post('one'))).rejects.toThrow(ValueTakenError);
    await expect(updatePost(two.id, post('one'))).rejects.toThrow(ValueTakenError);
    await expect(updatePost(two.id, post('two'))).resolves.toMatchObject({ slug: 'two' });
  });

  it('refuses an empty language, a missing picture and an extra field', async () => {
    await expect(createPost({ ...post('x'), title: pair('Başlık', '') })).rejects.toThrow();
    await expect(createPost({ ...post('x'), imageUrl: 'http://store.example.com/x.webp' })).rejects.toThrow();
    await expect(createPost({ ...post('x'), author: 'Someone' })).rejects.toThrow();
    await expect(createPost({ ...post('x'), publishedAt: new Date('nope') })).rejects.toThrow();
  });

  it('reports a missing post on update and delete', async () => {
    await expect(updatePost('missing', post('x'))).rejects.toThrow(ContentNotFoundError);
    await expect(deletePost('missing')).rejects.toThrow(ContentNotFoundError);
  });

  it('keeps the old slug as a redirect to the current one, however often it changed', async () => {
    const one = await createPost(post('one'));
    await updatePost(one.id, post('two'));
    await updatePost(one.id, post('three'));
    expect(await getPublishedPostRedirect('one')).toBe('three');
    expect(await getPublishedPostRedirect('two')).toBe('three');
    expect(await getPublishedPostRedirect('three')).toBeNull();
    expect(await getPublishedPostRedirect('unknown')).toBeNull();
    expect(await getPublishedPostRedirect('Not A Slug')).toBeNull();
    expect(await getDb().blogPostSlugRedirect.count()).toBe(2);
  });

  it('gives a draft or a future post no redirect', async () => {
    const draft = await createPost(post('draft-old', null));
    await updatePost(draft.id, post('draft-new', null));
    expect(await getPublishedPostRedirect('draft-old')).toBeNull();
    await updatePost(draft.id, post('draft-new', new Date(Date.now() + 86_400_000)));
    expect(await getPublishedPostRedirect('draft-old')).toBeNull();
    await updatePost(draft.id, post('draft-new', day('2026-03-01')));
    expect(await getPublishedPostRedirect('draft-old')).toBe('draft-new');
  });

  it('keeps a redirect from being taken by another post, and frees it for the post itself', async () => {
    const one = await createPost(post('one'));
    const other = await createPost(post('other'));
    await updatePost(one.id, post('two'));
    await expect(createPost(post('one'))).rejects.toThrow(ValueTakenError);
    await expect(updatePost(other.id, post('one'))).rejects.toThrow(ValueTakenError);
    expect(await getPublishedPostRedirect('one')).toBe('two');
    await updatePost(one.id, post('one'));
    expect(await getPublishedPostRedirect('one')).toBeNull();
    expect(await getPublishedPostRedirect('two')).toBe('one');
  });

  it('does not remember a redirect when the slug stays the same or the update fails', async () => {
    const one = await createPost(post('one'));
    const two = await createPost(post('two'));
    await updatePost(one.id, { ...post('one'), title: pair('Yeni', 'New') });
    await expect(updatePost(two.id, post('one'))).rejects.toThrow(ValueTakenError);
    expect(await getDb().blogPostSlugRedirect.count()).toBe(0);
  });

  it('deletes the redirects with the post', async () => {
    const one = await createPost(post('one'));
    await updatePost(one.id, post('two'));
    await deletePost(one.id);
    expect(await getDb().blogPostSlugRedirect.count()).toBe(0);
    expect(await getPublishedPostRedirect('one')).toBeNull();
  });

  it('deletes a post', async () => {
    const one = await createPost(post('one'));
    await deletePost(one.id);
    expect(await listPosts()).toEqual([]);
  });

  it('refuses every write in the demo and changes nothing', async () => {
    const one = await createPost(post('one'));
    vi.stubEnv('DEMO_MODE', 'true');
    await expect(createPost(post('two'))).rejects.toThrow(DemoModeError);
    await expect(updatePost(one.id, post('one', null))).rejects.toThrow(DemoModeError);
    await expect(updatePost(one.id, post('renamed'))).rejects.toThrow(DemoModeError);
    expect(await getDb().blogPostSlugRedirect.count()).toBe(0);
    await expect(deletePost(one.id)).rejects.toThrow(DemoModeError);
    expect(await getPost(one.id)).toEqual(one);
  });
});
