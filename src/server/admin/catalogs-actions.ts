'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createCatalog, deleteCatalog, listCatalogs, reorderCatalogs, updateCatalog } from '../content/catalogs.ts';
import { assertWritable } from '../demo/guard.ts';
import { storedFileSize } from '../storage/index.ts';
import { discardChangedFiles } from './files.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

const FILE_FIELDS = ['pdfUrl', 'coverImageUrl'] as const;

// The size comes from the file store, never from the form.
async function catalogInput(formData: FormData, currentId?: string) {
  // Before the lookup, so the demo says read-only, not that the file store is off.
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
    imageAlt: formPair(formData, 'imageAlt'),
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
    const before = (await listCatalogs()).find((item) => item.id === id);
    const saved = await updateCatalog(id, await catalogInput(formData, id));
    await discardChangedFiles(before, saved, FILE_FIELDS);
    refresh();
  });
}

export async function deleteCatalogAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = (await listCatalogs()).find((item) => item.id === id);
    await deleteCatalog(id);
    await discardChangedFiles(before, null, FILE_FIELDS);
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
