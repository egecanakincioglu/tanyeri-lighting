'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createPost, deletePost, getPost, updatePost } from '../content/blog.ts';
import { discardChangedFiles } from './files.ts';
import { formPair, formText, runAction, type FormState } from './form.ts';

const FILE_FIELDS = ['imageUrl'] as const;

// Empty means a draft; any other text that is not a day becomes an invalid date, which the schema refuses.
function publishedAt(formData: FormData): Date | null {
  const value = formText(formData, 'publishedAt').trim();
  if (value === '') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(Number.NaN);
}

function postInput(formData: FormData) {
  return {
    slug: formText(formData, 'slug'),
    imageUrl: formText(formData, 'imageUrl'),
    title: formPair(formData, 'title'),
    description: formPair(formData, 'description'),
    excerpt: formPair(formData, 'excerpt'),
    body: formPair(formData, 'body'),
    imageAlt: formPair(formData, 'imageAlt'),
    publishedAt: publishedAt(formData),
  };
}

export async function createPostAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createPost(postInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/blog' }));
  }
  return result;
}

export async function updatePostAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await getPost(id);
    const saved = await updatePost(id, postInput(formData));
    await discardChangedFiles(before, saved, FILE_FIELDS);
    refresh();
  });
}

export async function deletePostAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await getPost(id);
    await deletePost(id);
    await discardChangedFiles(before, null, FILE_FIELDS);
    refresh();
  });
}
