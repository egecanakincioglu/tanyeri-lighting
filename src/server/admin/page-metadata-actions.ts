'use server';

import { refresh } from 'next/cache';
import { guardAction } from '../auth/guard.ts';
import { upsertPageMetadata } from '../content/page-metadata.ts';
import { formPair, formText, runAction, type FormState } from './form.ts';

export async function savePageMetadataAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    await upsertPageMetadata(formText(formData, 'pageKey'), {
      title: formPair(formData, 'title'),
      description: formPair(formData, 'description'),
    });
    refresh();
  });
}
