import type { BlogPost as BlogPostRow } from '../../generated/prisma/client.ts';
import { getDb } from '../db.ts';
import { assertWritable } from '../demo/guard.ts';
import { fromColumns, toColumns } from './bilingual.ts';
import { ContentNotFoundError, isRecordNotFound, mapUniqueViolation } from './errors.ts';
import { blogPostSchema, type BlogPost, type BlogPostInput, type BlogPostSummary, idSchema } from './schemas.ts';

// A draft has no publication date, and a date in the future is not public yet. Every public read goes through this
// filter, so there is one rule for what a visitor can see.
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

// The published articles, newest first, without their bodies.
export async function listPublishedPosts(): Promise<BlogPostSummary[]> {
  const rows = await getDb().blogPost.findMany({ where: isPublic(), orderBy: newestFirst, omit: noBody });
  return rows.map(summaryFromRow);
}

// The newest published articles other than the given one, for the links under an article.
export async function listOtherPosts(slug: string, limit: number): Promise<BlogPostSummary[]> {
  const rows = await getDb().blogPost.findMany({
    where: { ...isPublic(), slug: { not: slug } },
    orderBy: newestFirst,
    take: limit,
    omit: noBody,
  });
  return rows.map(summaryFromRow);
}

// A draft or an unknown slug gives null.
export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  const row = await getDb().blogPost.findFirst({ where: { ...isPublic(), slug } });
  return row ? fromRow(row) : null;
}

export async function listPostChanges(): Promise<{ slug: string; updatedAt: Date }[]> {
  return getDb().blogPost.findMany({
    where: isPublic(),
    select: { slug: true, updatedAt: true },
    orderBy: newestFirst,
  });
}

// For the panel: drafts included, drafts first.
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

export async function createPost(input: unknown): Promise<BlogPost> {
  assertWritable();
  const columns = toColumnsOf(blogPostSchema.parse(input));
  try {
    return fromRow(await getDb().blogPost.create({ data: columns }));
  } catch (error) {
    throw mapUniqueViolation(error);
  }
}

export async function updatePost(id: unknown, input: unknown): Promise<BlogPost> {
  assertWritable();
  const postId = idSchema.parse(id);
  const columns = toColumnsOf(blogPostSchema.parse(input));
  try {
    return fromRow(await getDb().blogPost.update({ where: { id: postId }, data: columns }));
  } catch (error) {
    if (isRecordNotFound(error)) throw new ContentNotFoundError('Blog post');
    throw mapUniqueViolation(error);
  }
}

export async function deletePost(id: unknown): Promise<void> {
  assertWritable();
  const result = await getDb().blogPost.deleteMany({ where: { id: idSchema.parse(id) } });
  if (result.count === 0) throw new ContentNotFoundError('Blog post');
}
