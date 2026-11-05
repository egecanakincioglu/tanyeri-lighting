'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createService, deleteService, listServices, reorderServices, updateService } from '../content/services.ts';
import { discardChangedFiles } from './files.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

const FILE_FIELDS = ['imageUrl'] as const;

async function findService(id: string) {
  return (await listServices()).find((item) => item.id === id);
}

function serviceInput(formData: FormData) {
  return {
    imageUrl: formText(formData, 'imageUrl'),
    imageAlt: formPair(formData, 'imageAlt'),
    title: formPair(formData, 'title'),
    description: formPair(formData, 'description'),
    note: formPair(formData, 'note'),
  };
}

export async function createServiceAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createService(serviceInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/services' }));
  }
  return result;
}

export async function updateServiceAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findService(id);
    const saved = await updateService(id, serviceInput(formData));
    await discardChangedFiles(before, saved, FILE_FIELDS);
    refresh();
  });
}

export async function deleteServiceAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const id = formText(formData, 'id');
    const before = await findService(id);
    await deleteService(id);
    await discardChangedFiles(before, null, FILE_FIELDS);
    refresh();
  });
}

export async function reorderServicesAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderServices(ids);
    refresh();
  });
}
