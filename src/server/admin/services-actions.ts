'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createService, deleteService, reorderServices, updateService } from '../content/services.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

function serviceInput(formData: FormData) {
  return {
    imageUrl: formText(formData, 'imageUrl'),
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
    await updateService(formText(formData, 'id'), serviceInput(formData));
    refresh();
  });
}

export async function deleteServiceAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deleteService(formText(formData, 'id'));
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
