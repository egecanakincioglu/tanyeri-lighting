'use server';

import { redirect } from 'next/navigation';
import { getDb } from '../db.ts';
import { callAuth } from './call.ts';
import { panelPath, safeLocale } from './paths.ts';

export type SignInState = { status: 'error' | 'rate-limited'; email: string };

const MAX_LENGTH = 1000;

function text(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.slice(0, MAX_LENGTH) : '';
}

// Public on purpose (allowlisted in check-admin-guard.ts).
// Every failure gives the same answer, so the form does not reveal which addresses exist.
export async function signInAction(_previous: SignInState | null, formData: FormData): Promise<SignInState> {
  const email = text(formData.get('email')).trim();
  const password = text(formData.get('password'));
  if (!email || !password) return { status: 'error', email };

  const response = await callAuth('/sign-in/email', { email, password });
  if (response.status === 429) return { status: 'rate-limited', email };
  if (!response.ok) return { status: 'error', email };

  // The library never removes expired rows. A failure here must not turn a good sign-in into an error.
  try {
    await getDb().session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {}

  redirect(panelPath(safeLocale(formData.get('locale'))));
}
