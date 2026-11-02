'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { createPromoBoard, deletePromoBoard, reorderPromoBoards, updatePromoBoard } from '../content/promo-boards.ts';
import { failure, formPair, formText, runAction, type FormState } from './form.ts';

function boardInput(formData: FormData) {
  return {
    imageUrl: formText(formData, 'imageUrl'),
    title: formPair(formData, 'title'),
    subtitle: formPair(formData, 'subtitle'),
    catalogId: formText(formData, 'catalogId'),
  };
}

export async function createPromoBoardAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await createPromoBoard(boardInput(formData));
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/promo-boards' }));
  }
  return result;
}

export async function updatePromoBoardAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await updatePromoBoard(formText(formData, 'id'), boardInput(formData));
    refresh();
  });
}

export async function deletePromoBoardAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await deletePromoBoard(formText(formData, 'id'));
    refresh();
  });
}

export async function reorderPromoBoardsAction(ids: string[]): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    if (!Array.isArray(ids)) return failure('invalidOrder');
    await reorderPromoBoards(ids);
    refresh();
  });
}
