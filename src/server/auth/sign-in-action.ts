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

// The sign-in form. Public on purpose (allowlisted in tooling/scripts/check-admin-guard.ts): it is how a visitor gets
// a session. It works as a plain form post. An unknown address, a wrong password and a malformed address all give
// the same answer, so the form does not reveal which addresses exist. The limits are those of the auth layer.
export async function signInAction(_previous: SignInState | null, formData: FormData): Promise<SignInState> {
  const email = text(formData.get('email')).trim();
  const password = text(formData.get('password'));
  if (!email || !password) return { status: 'error', email };

  const response = await callAuth('/sign-in/email', { email, password });
  if (response.status === 429) return { status: 'rate-limited', email };
  if (!response.ok) return { status: 'error', email };

  // Expired rows are never removed by the library; clearing them here keeps the table small. A failure must not
  // turn a good sign-in into an error, and the next sign-in sweeps again.
  try {
    await getDb().session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  } catch {
    // Left for the next sign-in.
  }

  redirect(panelPath(safeLocale(formData.get('locale'))));
}
