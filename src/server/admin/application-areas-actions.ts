'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import {
  createApplicationArea,
  deleteApplicationArea,
  listApplicationAreas,
  reorderApplicationAreas,
  updateApplicationArea,
} from '../content/application-areas.ts';
import { discardChangedFiles } from './files.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

const FILE_FIELDS = ['imageUrl'] as const;

// The record as it is before a change, to know which files the change leaves behind.
async function findApplicationArea(id: string) {
  return (await listApplicationAreas()).find((item) => item.id === id);
}

function areaInput(formData: FormData) {
  return {
    imageUrl: formText(formData, 'imageUrl'),
    title: formPair(formData, 'title'),
    description: formPair(formData, 'description'),
  };
}

export async function createApplicationAreaAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createApplicationArea(areaInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/application-areas' }));
  }
  return result;
}

export async function updateApplicationAreaAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findApplicationArea(id);
    const saved = await updateApplicationArea(id, areaInput(formData));
    await discardChangedFiles(before, saved, FILE_FIELDS);
    refresh();
  });
}

export async function deleteApplicationAreaAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findApplicationArea(id);
    await deleteApplicationArea(id);
    await discardChangedFiles(before, null, FILE_FIELDS);
    refresh();
  });
}

export async function reorderApplicationAreasAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderApplicationAreas(ids);
    refresh();
  });
}
