'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import {
  createApplicationArea,
  deleteApplicationArea,
  reorderApplicationAreas,
  updateApplicationArea,
} from '../content/application-areas.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

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
    await updateApplicationArea(formText(formData, 'id'), areaInput(formData));
    refresh();
  });
}

export async function deleteApplicationAreaAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deleteApplicationArea(formText(formData, 'id'));
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
