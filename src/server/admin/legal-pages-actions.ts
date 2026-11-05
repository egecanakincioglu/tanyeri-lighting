'use server';

import { refresh } from 'next/cache';
import { guardAction } from '../auth/guard.ts';
import { deleteLegalPage, upsertLegalPage } from '../content/legal-pages.ts';
import { formPair, formText, runAction, type FormState } from './form.ts';

// All four texts empty hides the page; otherwise both languages are needed.
export async function saveLegalPageAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const key = formText(formData, 'pageKey');
    const title = formPair(formData, 'title');
    const body = formPair(formData, 'body');
    const empty = [title.tr, title.en, body.tr, body.en].every((text) => text.trim() === '');
    if (empty) await deleteLegalPage(key);
    else await upsertLegalPage(key, { title, body });
    refresh();
  });
}
