'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { getPathname } from '../../i18n/navigation.ts';
import { guardAction } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { deleteMessage } from '../contact/service.ts';
import { formText, runAction, type FormState } from './form.ts';

// Deletes one message and goes back to the list. Nothing of the message is logged: it holds personal data.
export async function deleteMessageAction(_previous: FormState | null, formData: FormData): Promise<FormState> {
  const result = await runAction(async () => {
    await guardAction();
    await deleteMessage(formText(formData, 'id'));
    refresh();
  });
  if (result.status === 'success') {
    redirect(getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/messages' }));
  }
  return result;
}
