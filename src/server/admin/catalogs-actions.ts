'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createCatalog, deleteCatalog, listCatalogs, reorderCatalogs, updateCatalog } from '../content/catalogs.ts';
import { assertWritable } from '../demo/guard.ts';
import { storedFileSize } from '../storage/index.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

// The size is what the file store holds for the address, never a value of the form. A catalog whose PDF did not change
// keeps the size it has, so saving the name does not need the store.
async function catalogInput(formData: FormData, currentId?: string) {
  // Before the lookup, so the demo answers that it is read-only and not that the file store is off.
  assertWritable();
  const pdfUrl = formText(formData, 'pdfUrl');
  let sizeBytes = 0;
  if (pdfUrl !== '') {
    const current = currentId ? (await listCatalogs()).find((catalog) => catalog.id === currentId) : undefined;
    sizeBytes = current?.pdfUrl === pdfUrl ? current.sizeBytes : await storedFileSize(pdfUrl);
  }
  return {
    name: formPair(formData, 'name'),
    pdfUrl,
    coverImageUrl: formText(formData, 'coverImageUrl'),
    sizeBytes,
  };
}

export async function createCatalogAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createCatalog(await catalogInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/catalogs' }));
  }
  return result;
}

export async function updateCatalogAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    await updateCatalog(id, await catalogInput(formData, id));
    refresh();
  });
}

export async function deleteCatalogAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deleteCatalog(formText(formData, 'id'));
    refresh();
  });
}

export async function reorderCatalogsAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderCatalogs(ids);
    refresh();
  });
}
