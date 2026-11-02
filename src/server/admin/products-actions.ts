'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createProduct, deleteProduct, reorderProducts, updateProduct } from '../content/products.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

function productInput(formData: FormData) {
  return {
    categoryId: formText(formData, 'categoryId'),
    slug: formText(formData, 'slug'),
    code: formText(formData, 'code'),
    name: formPair(formData, 'name'),
    color: formPair(formData, 'color'),
    material: formPair(formData, 'material'),
    power: formText(formData, 'power'),
    dimensions: formText(formData, 'dimensions'),
    imageUrl: formText(formData, 'imageUrl'),
  };
}

export async function createProductAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createProduct(productInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/products' }));
  }
  return result;
}

export async function updateProductAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await updateProduct(formText(formData, 'id'), productInput(formData));
    refresh();
  });
}

export async function deleteProductAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deleteProduct(formText(formData, 'id'));
    refresh();
  });
}

// The order of one category: the list page binds the category's id and offers the arrows only for a whole category.
export async function reorderProductsAction(categoryId: string, ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (typeof categoryId !== 'string' || !Array.isArray(ids)) return failure('invalidOrder');
    await reorderProducts(categoryId, ids);
    refresh();
  });
}
