'use server';

import { redirect } from 'next/navigation';
import { callAuth } from './call.ts';
import { guardAction, UnauthorizedError } from '../auth/guard.ts';
import { safeLocale, signInPath } from './paths.ts';

// The guard is imported by its full path because tooling/scripts/check-admin-guard.ts looks for it that way.
// A real form post. Without a session there is nothing to end, and the visitor lands on the sign-in page either way.
export async function signOutAction(formData: FormData): Promise<void> {
  let signedIn = true;
  try {
    await guardAction();
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error;
    signedIn = false;
  }
  if (signedIn) await callAuth('/sign-out', {});
  redirect(signInPath(safeLocale(formData.get('locale'))));
}
