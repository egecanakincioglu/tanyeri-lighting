'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createCategory, deleteCategory, reorderCategories, updateCategory } from '../content/categories.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

function categoryInput(formData: FormData) {
  return {
    key: formText(formData, 'key'),
    name: formPair(formData, 'name'),
    seoTitle: formPair(formData, 'seoTitle'),
    seoDescription: formPair(formData, 'seoDescription'),
    h1: formPair(formData, 'h1'),
    intro: formPair(formData, 'intro'),
  };
}

export async function createCategoryAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createCategory(categoryInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/categories' }));
  }
  return result;
}

export async function updateCategoryAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await updateCategory(formText(formData, 'id'), categoryInput(formData));
    refresh();
  });
}

export async function deleteCategoryAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deleteCategory(formText(formData, 'id'));
    refresh();
  });
}

export async function reorderCategoriesAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderCategories(ids);
    refresh();
  });
}
