'use server';

import { refresh } from 'next/cache';
import { guardAction } from '../auth/guard.ts';
import { getHomeBanner, updateHomeBanner } from '../content/home-banner.ts';
import { discardChangedFiles } from './files.ts';
import { formPair, formText, runAction, type FormState } from './form.ts';

function actionInput(formData: FormData, name: 'primary' | 'secondary') {
  return { label: formPair(formData, `${name}Label`), target: formText(formData, `${name}Target`) };
}

// The banner is one row: the form always saves all of it.
export async function updateBannerAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  return runAction(async () => {
    await guardAction();
    const before = await getHomeBanner();
    const saved = await updateHomeBanner({
      imageUrl: formText(formData, 'imageUrl'),
      title: formPair(formData, 'title'),
      description: formPair(formData, 'description'),
      primaryAction: actionInput(formData, 'primary'),
      secondaryAction: actionInput(formData, 'secondary'),
    });
    await discardChangedFiles(before, saved, ['imageUrl']);
    refresh();
  });
}
