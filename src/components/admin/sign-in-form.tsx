'use client';

import { useActionState, useState } from 'react';
import type { SignInState } from '../../server/auth/sign-in-action.ts';
import { Button } from '../button.tsx';
import { TextField } from '../field.tsx';

export type SignInFormTexts = {
  email: string;
  passLabel: string;
  submit: string;
  submitting: string;
  error: string;
  rateLimited: string;
};

type SignInFormProps = {
  /** The Server Action; it also runs when the form is posted without JavaScript. */
  action: (previous: SignInState | null, formData: FormData) => Promise<SignInState>;
  locale: string;
  texts: SignInFormTexts;
};

const ERROR_ID = 'sign-in-error';

export function SignInForm({ action, locale, texts }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  // Controlled, so the address survives a refused attempt. The password is never sent back to the page.
  const [email, setEmail] = useState(state?.email ?? '');
  const message = state ? (state.status === 'rate-limited' ? texts.rateLimited : texts.error) : null;
  const described = message ? ERROR_ID : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {/* The region stays in the page, so a screen reader announces whatever it receives after an attempt. */}
      <div id={ERROR_ID} role="alert">
        {message && <p className="font-medium text-error">{message}</p>}
      </div>
      <TextField
        id="email"
        name="email"
        type="email"
        label={texts.email}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-describedby={described}
      />
      <TextField
        id="password"
        name="password"
        type="password"
        label={texts.passLabel}
        autoComplete="current-password"
        required
        aria-describedby={described}
      />
      <Button type="submit" disabled={pending}>
        {pending ? texts.submitting : texts.submit}
      </Button>
    </form>
  );
}
