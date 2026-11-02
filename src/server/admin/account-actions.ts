'use server';

import { z } from 'zod';
import { getPathname } from '../../i18n/navigation.ts';
import { callAuth } from '../auth/call.ts';
import { guardAction, UnauthorizedError } from '../auth/guard.ts';
import { safeLocale } from '../auth/paths.ts';
import { isDemoMode, isEmailEnabled } from '../env.ts';
import { formText } from './form.ts';

export type AccountField = 'currentPassword' | 'newPassword' | 'confirm' | 'email';
type AccountIssue = 'required' | 'wrongCurrent' | 'tooShort' | 'tooLong' | 'mismatch' | 'invalid' | 'same';
type AccountCode = 'invalid' | 'demo' | 'unauthorized' | 'rateLimited' | 'emailOff' | 'generic';
export type AccountState =
  { status: 'success' } | { status: 'error'; code: AccountCode; fields: Partial<Record<AccountField, AccountIssue>> };

// The auth layer's own limits, as Better Auth 1.7.14 sets them for its password rules.
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;

function failed(code: AccountCode, fields: Partial<Record<AccountField, AccountIssue>> = {}): AccountState {
  return { status: 'error', code, fields };
}

async function checked(work: () => Promise<AccountState>): Promise<AccountState> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof UnauthorizedError) return failed('unauthorized');
    console.error('Account action failed', error instanceof Error ? error.name : 'unknown');
    return failed('generic');
  }
}

// The passwords go to the auth layer only; they are never logged or sent back to the form.
export async function changePasswordAction(_previous: AccountState | null, formData: FormData): Promise<AccountState> {
  return checked(async () => {
    await guardAction();
    if (isDemoMode()) return failed('demo');
    const currentPassword = formText(formData, 'currentPassword');
    const newPassword = formText(formData, 'newPassword');
    const fields: Partial<Record<AccountField, AccountIssue>> = {};
    if (currentPassword === '') fields.currentPassword = 'required';
    if (newPassword === '') fields.newPassword = 'required';
    else if (newPassword.length < MIN_PASSWORD) fields.newPassword = 'tooShort';
    else if (newPassword.length > MAX_PASSWORD) fields.newPassword = 'tooLong';
    else if (newPassword === currentPassword) fields.newPassword = 'same';
    if (!fields.newPassword && formText(formData, 'confirm') !== newPassword) fields.confirm = 'mismatch';
    if (Object.keys(fields).length > 0) return failed('invalid', fields);

    const response = await callAuth('/change-password', { currentPassword, newPassword });
    if (response.status === 429) return failed('rateLimited');
    if (response.status === 400) return failed('invalid', { currentPassword: 'wrongCurrent' });
    if (!response.ok) return failed('generic');
    // A separate call, not the library's revokeOtherSessions flag: that flag also replaces this session's token, and
    // the page that redraws after the action still holds the old cookie, so it would find no session and sign out.
    const others = await callAuth('/revoke-other-sessions', {});
    if (!others.ok) return failed('generic');
    return { status: 'success' };
  });
}

const emailSchema = z.email().max(254);

export async function changeEmailAction(_previous: AccountState | null, formData: FormData): Promise<AccountState> {
  return checked(async () => {
    const session = await guardAction();
    if (isDemoMode()) return failed('demo');
    if (!isEmailEnabled()) return failed('emailOff');
    const email = formText(formData, 'email').trim();
    if (email === '') return failed('invalid', { email: 'required' });
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return failed('invalid', { email: 'invalid' });
    if (parsed.data.toLowerCase() === session.user.email.toLowerCase()) return failed('invalid', { email: 'same' });

    // The library answers alike for a free and a taken address, so the form can not tell them apart either.
    const callbackURL = getPathname({ locale: safeLocale(formText(formData, 'locale')), href: '/dashboard/account' });
    const response = await callAuth('/change-email', { newEmail: parsed.data, callbackURL });
    if (response.status === 429) return failed('rateLimited');
    if (!response.ok) return failed('generic');
    return { status: 'success' };
  });
}
