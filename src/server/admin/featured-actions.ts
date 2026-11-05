'use server';

import { refresh } from 'next/cache';
import { guardAction } from '../auth/guard.ts';
import { setFeaturedProducts } from '../content/featured-products.ts';
import { failure, runAction, type FormState } from './form.ts';

export async function saveFeaturedProductsAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await setFeaturedProducts(ids);
    refresh();
  });
}
