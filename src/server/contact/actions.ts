'use server';

import { headers } from 'next/headers';
import { isDemoMode } from '../env.ts';
import { checkRateLimit } from '../rate-limit/index.ts';
import { isHoneypotFilled, parseContactForm, submittedValues } from './form.ts';
import type { ContactState } from './form.ts';
import { createContactMessage } from './service.ts';

const RATE_LIMIT = { scope: 'contact', limit: 5, windowSeconds: 60 * 60 } as const;

// The public contact form. Public on purpose (allowlisted in tooling/scripts/check-admin-guard.ts), so it does its
// own protection: a honeypot, validation, and a limit per client address. It works as a plain form post, too.
export async function submitContactMessage(_previous: ContactState | null, formData: FormData): Promise<ContactState> {
  // Looks accepted, so a script learns nothing; nothing is stored and no counter is touched.
  if (isHoneypotFilled(formData)) return { status: 'ok' };

  // Validation runs before the limit, so a typo does not use up one of the visitor's submissions.
  const parsed = parseContactForm(formData);
  if (!parsed.success) return { status: 'invalid', fieldErrors: parsed.fieldErrors, values: submittedValues(formData) };

  const limit = await checkRateLimit({ ...RATE_LIMIT, headers: await headers() });
  if (!limit.ok)
    return { status: 'rate-limited', retryAfterSeconds: limit.retryAfterSeconds, values: submittedValues(formData) };

  const { name, email, subject, message } = parsed.data;
  if (isDemoMode()) return { status: 'demo', summary: { name, email, subject, message } };

  await createContactMessage(parsed.data);
  return { status: 'ok' };
}
