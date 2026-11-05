'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import {
  createReference,
  deleteReference,
  listReferences,
  reorderReferences,
  updateReference,
} from '../content/references.ts';
import { discardChangedFiles } from './files.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

const FILE_FIELDS = ['imageUrl'] as const;

async function findReference(id: string) {
  return (await listReferences()).find((item) => item.id === id);
}

// The public pages read the database on every request, so refresh() only redraws the panel screen.

function referenceInput(formData: FormData) {
  return {
    imageUrl: formText(formData, 'imageUrl'),
    imageAlt: formPair(formData, 'imageAlt'),
    name: formText(formData, 'name'),
    title: formPair(formData, 'title'),
    description: formPair(formData, 'description'),
  };
}

export async function createReferenceAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createReference(referenceInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/references' }));
  }
  return result;
}

export async function updateReferenceAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findReference(id);
    const saved = await updateReference(id, referenceInput(formData));
    await discardChangedFiles(before, saved, FILE_FIELDS);
    refresh();
  });
}

export async function deleteReferenceAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findReference(id);
    await deleteReference(id);
    await discardChangedFiles(before, null, FILE_FIELDS);
    refresh();
  });
}

export async function reorderReferencesAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderReferences(ids);
    refresh();
  });
}
