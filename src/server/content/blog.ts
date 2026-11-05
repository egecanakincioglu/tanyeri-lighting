import type { BlogPost as BlogPostRow, Prisma } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, mapUniqueViolation, ValueTakenError } from './errors.ts';
import {
  blogPostSchema,
  idSchema,
  KEBAB_CASE,
  type BlogPost,
  type BlogPostInput,
  type BlogPostSummary,
} from './schemas.ts';

// Drafts and future dates are not public. Every public read uses this filter.
const isPublic = () => ({ publishedAt: { not: null, lte: new Date() } });

const newestFirst = [{ publishedAt: 'desc' as const }, { id: 'desc' as const }];

function summaryFromRow(row: Omit<BlogPostRow, 'bodyTr' | 'bodyEn'>): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: fromColumns('title', row),
    description: fromColumns('description', row),
    excerpt: fromColumns('excerpt', row),
    imageUrl: row.imageUrl,
    imageAlt: fromColumns('imageAlt', row),
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function fromRow(row: BlogPostRow): BlogPost {
  return { ...summaryFromRow(row), body: fromColumns('body', row) };
}

function toColumnsOf(post: BlogPostInput) {
  return {
    slug: post.slug,
    imageUrl: post.imageUrl,
    publishedAt: post.publishedAt,
    ...toColumns('title', post.title),
    ...toColumns('description', post.description),
    ...toColumns('excerpt', post.excerpt),
    ...toColumns('body', post.body),
    ...toColumns('imageAlt', post.imageAlt),
  };
}

const noBody = { bodyTr: true, bodyEn: true } as const;

export async function listPublishedPosts(): Promise<BlogPostSummary[]> {
  const rows = await getDb().blogPost.findMany({ where: isPublic(), orderBy: newestFirst, omit: noBody });
  return rows.map(summaryFromRow);
}

export async function listOtherPosts(slug: string, limit: number): Promise<BlogPostSummary[]> {
  const rows = await getDb().blogPost.findMany({
    where: { ...isPublic(), slug: { not: slug } },
    orderBy: newestFirst,
    take: limit,
    omit: noBody,
  });
  return rows.map(summaryFromRow);
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  const row = await getDb().blogPost.findFirst({ where: { ...isPublic(), slug } });
  return row ? fromRow(row) : null;
}

// An old slug of a published article gives its current slug. Old slugs of drafts are not resolved.
export async function getPublishedPostRedirect(slug: string): Promise<string | null> {
  if (!KEBAB_CASE.test(slug)) return null;
  const redirect = await getDb().blogPostSlugRedirect.findUnique({
    where: { oldSlug: slug },
    select: { post: { select: { slug: true, publishedAt: true } } },
  });
  const { post } = redirect ?? {};
  return post?.publishedAt && post.publishedAt <= new Date() ? post.slug : null;
}

export async function listPostChanges(): Promise<{ slug: string; updatedAt: Date }[]> {
  return getDb().blogPost.findMany({
    where: isPublic(),
    select: { slug: true, updatedAt: true },
    orderBy: newestFirst,
  });
}

export async function listPosts(): Promise<BlogPostSummary[]> {
  const rows = await getDb().blogPost.findMany({
    orderBy: [{ publishedAt: { sort: 'desc', nulls: 'first' } }, { id: 'desc' }],
    omit: noBody,
  });
  return rows.map(summaryFromRow);
}

export async function getPost(id: unknown): Promise<BlogPost | null> {
  const row = await getDb().blogPost.findUnique({ where: { id: idSchema.parse(id) } });
  return row ? fromRow(row) : null;
}

// Free if no other article has it or redirects from it. The article's own old slugs are free.
async function assertSlugFree(tx: Prisma.TransactionClient, slug: string, postId?: string): Promise<void> {
  const post = await tx.blogPost.findUnique({ where: { slug }, select: { id: true } });
  const redirect = await tx.blogPostSlugRedirect.findUnique({ where: { oldSlug: slug }, select: { postId: true } });
  if ((post && post.id !== postId) || (redirect && redirect.postId !== postId)) throw new ValueTakenError('slug');
}

export async function createPost(input: unknown): Promise<BlogPost> {
  assertWritable();
  const columns = toColumnsOf(blogPostSchema.parse(input));
  try {
    return fromRow(
      await getDb().$transaction(async (tx) => {
        await assertSlugFree(tx, columns.slug);
        return tx.blogPost.create({ data: columns });
      }),
    );
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

export async function updatePost(id: unknown, input: unknown): Promise<BlogPost> {
  assertWritable();
  const postId = idSchema.parse(id);
  const columns = toColumnsOf(blogPostSchema.parse(input));
  try {
    return fromRow(
      await getDb().$transaction(async (tx) => {
        const current = await tx.blogPost.findUnique({ where: { id: postId }, select: { slug: true } });
        if (!current) throw new ContentNotFoundError('Blog post');
        if (columns.slug !== current.slug) {
          await assertSlugFree(tx, columns.slug, postId);
          await tx.blogPostSlugRedirect.deleteMany({ where: { oldSlug: columns.slug, postId } });
          await tx.blogPostSlugRedirect.create({ data: { oldSlug: current.slug, postId } });
        }
        return tx.blogPost.update({ where: { id: postId }, data: columns });
      }),
    );
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

export async function deletePost(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().blogPost.deleteMany({ where: { id: idSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Blog post');
}
