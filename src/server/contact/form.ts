import { z } from 'zod';
import { routing } from '../../i18n/routing.ts';

// What the contact form sends and what the Server Action answers. Pure: no database, no request.

const CONTACT_FIELDS = ['name', 'email', 'subject', 'message', 'locale'] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];

// Hidden field that people never see or fill. A script that fills every input trips it.
export const HONEYPOT_FIELD = 'website';

export const MAX_LENGTH = { name: 100, email: 254, subject: 150, message: 5000 } as const;

// A code, not a sentence: the page translates it into the visitor's language.
type ContactFieldError = 'required' | 'too_long' | 'invalid';

export type ContactInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: (typeof routing.locales)[number];
};

type ContactSummary = Pick<ContactInput, 'name' | 'email' | 'subject' | 'message'>;

// The first state of useActionState is null.
export type ContactState =
  | { status: 'ok' }
  | { status: 'invalid'; fieldErrors: Partial<Record<ContactField, ContactFieldError>>; values: ContactSummary }
  | { status: 'rate-limited'; retryAfterSeconds: number; values: ContactSummary }
  | { status: 'demo'; summary: ContactSummary };

// Postgres text columns refuse the NUL character, so it would end in a server error instead of a field error.
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !value.includes('\0'));

const contactSchema = z.object({
  name: text(MAX_LENGTH.name),
  email: text(MAX_LENGTH.email).pipe(z.email()),
  subject: text(MAX_LENGTH.subject),
  message: text(MAX_LENGTH.message),
  locale: z.enum(routing.locales),
});

export function isHoneypotFilled(formData: FormData): boolean {
  const value = formData.get(HONEYPOT_FIELD);
  return value !== null && !(typeof value === 'string' && value.trim() === '');
}

// What the visitor typed, untrimmed, so a refused submission can fill the form again (also without JavaScript). The honeypot is never part of it.
export function submittedValues(formData: FormData): ContactSummary {
  const read = (field: string) => {
    const value = formData.get(field);
    return typeof value === 'string' ? value : '';
  };
  return { name: read('name'), email: read('email'), subject: read('subject'), message: read('message') };
}

export type ParsedContact =
  | { success: true; data: ContactInput }
  | { success: false; fieldErrors: Partial<Record<ContactField, ContactFieldError>> };

export function parseContactForm(formData: FormData): ParsedContact {
  const raw: Record<string, string> = {};
  for (const field of CONTACT_FIELDS) {
    const value = formData.get(field);
    raw[field] = typeof value === 'string' ? value : '';
  }
  const result = contactSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };

  const fieldErrors: Partial<Record<ContactField, ContactFieldError>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ContactField;
    if (fieldErrors[field]) continue;
    fieldErrors[field] = issue.code === 'too_big' ? 'too_long' : raw[field]?.trim() === '' ? 'required' : 'invalid';
  }
  return { success: false, fieldErrors };
}

// A ceiling for the whole site, so many client addresses together cannot fill the inbox.
export const SITE_WIDE_LIMIT = { scope: 'contact-site', limit: 200, windowSeconds: 24 * 60 * 60 } as const;
