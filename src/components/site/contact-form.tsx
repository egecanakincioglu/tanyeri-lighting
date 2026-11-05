'use client';

import { type ReactNode, useActionState, useState } from 'react';
import type { ContactState } from '../../server/contact/form.ts';
import { Button } from '../button.tsx';
import { TextAreaField, TextField } from '../field.tsx';

export type ContactFormTexts = {
  name: string;
  email: string;
  subject: string;
  message: string;
  send: string;
  sending: string;
  errors: { required: string; too_long: string; invalid: string };
  invalidSummary: string;
  /** Holds `{minutes}`. */
  rateLimited: string;
  okTitle: string;
  okText: string;
  demoTitle: string;
  demoNote: string;
};

type ContactFormProps = {
  /** Also runs when the form is posted without JavaScript. */
  action: (previous: ContactState | null, formData: FormData) => Promise<ContactState>;
  locale: string;
  honeypotName: string;
  limits: { name: number; email: number; subject: number; message: number };
  texts: ContactFormTexts;
  initialValues?: { subject?: string };
};

const resultClass = 'rounded-lg border border-hairline bg-surface p-6 shadow-sm';

// Lowercase attributes read by in-page tool support; the spread keeps them out of the form element's typed props.
const WEBMCP_HINTS: Record<string, string> = {
  toolname: 'send_contact_message',
  tooldescription: 'Sends a message to the company through the contact form: name, email, subject and message.',
};

export function ContactForm({ action, locale, honeypotName, limits, texts, initialValues }: ContactFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  // Controlled, so the visitor's words survive a refusal; without JavaScript the server sends them back.
  const [values, setValues] = useState(() =>
    state && 'values' in state
      ? state.values
      : { name: '', email: '', subject: initialValues?.subject ?? '', message: '' },
  );
  const bind = (field: keyof typeof values) => ({
    name: field,
    value: values[field],
    onChange: (event: { target: { value: string } }) => setValues({ ...values, [field]: event.target.value }),
  });

  const fieldErrors = state?.status === 'invalid' ? state.fieldErrors : {};
  const errorOf = (field: keyof typeof values) => {
    const code = fieldErrors[field];
    return code ? texts.errors[code] : undefined;
  };

  // One region stays in the page, so a screen reader announces whatever it receives after a submission.
  let announcement: ReactNode = null;
  if (state?.status === 'invalid') announcement = <p className="font-medium text-error">{texts.invalidSummary}</p>;
  if (state?.status === 'rate-limited') {
    const minutes = Math.max(1, Math.ceil(state.retryAfterSeconds / 60));
    announcement = <p className="font-medium text-error">{texts.rateLimited.replace('{minutes}', String(minutes))}</p>;
  }
  if (state?.status === 'ok') {
    announcement = (
      <div className={resultClass}>
        <h2 className="text-xl font-bold">{texts.okTitle}</h2>
        <p className="mt-2 text-muted">{texts.okText}</p>
      </div>
    );
  }
  if (state?.status === 'demo') {
    const rows = [
      [texts.name, state.summary.name],
      [texts.email, state.summary.email],
      [texts.subject, state.summary.subject],
      [texts.message, state.summary.message],
    ] as const;
    announcement = (
      <div className={resultClass}>
        <h2 className="text-xl font-bold">{texts.demoTitle}</h2>
        <p className="mt-2 text-muted">{texts.demoNote}</p>
        <dl className="mt-5 flex flex-col gap-4">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium tracking-wider text-muted uppercase">{label}</dt>
              <dd className="mt-1 break-words whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  const done = state?.status === 'ok' || state?.status === 'demo';

  return (
    <div className="flex flex-col gap-5">
      <div role="status">{announcement}</div>
      {!done && (
        <form action={formAction} className="flex flex-col gap-5" {...WEBMCP_HINTS}>
          <input type="hidden" name="locale" value={locale} />
          <div aria-hidden="true" className="sr-only">
            <input type="text" name={honeypotName} tabIndex={-1} autoComplete="off" />
          </div>
          <TextField
            id="contact-name"
            label={texts.name}
            type="text"
            autoComplete="name"
            required
            maxLength={limits.name}
            error={errorOf('name')}
            {...bind('name')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="contact-email"
              label={texts.email}
              type="email"
              autoComplete="email"
              required
              maxLength={limits.email}
              error={errorOf('email')}
              {...bind('email')}
            />
            <TextField
              id="contact-subject"
              label={texts.subject}
              type="text"
              required
              maxLength={limits.subject}
              error={errorOf('subject')}
              {...bind('subject')}
            />
          </div>
          <TextAreaField
            id="contact-message"
            label={texts.message}
            required
            maxLength={limits.message}
            error={errorOf('message')}
            {...bind('message')}
          />
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? texts.sending : texts.send}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
