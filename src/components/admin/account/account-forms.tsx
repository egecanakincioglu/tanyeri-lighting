'use client';

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from 'react';
import type { AccountField, AccountState } from '../../../server/admin/account-actions.ts';
import { SubmitButton } from '../submit-button.tsx';
import { TextField } from '../../field.tsx';

type Action = (previous: AccountState | null, formData: FormData) => Promise<AccountState>;

export type AccountTexts = {
  errors: Record<'invalid' | 'demo' | 'unauthorized' | 'rateLimited' | 'emailOff' | 'generic', string>;
  issues: Record<'required' | 'wrongCurrent' | 'tooShort' | 'tooLong' | 'mismatch' | 'invalid' | 'same', string>;
};

type Common = {
  action: Action;
  texts: AccountTexts;
  title: string;
  button: string;
  working: string;
  done: string;
  /** Why the form is off (the demo, or no outgoing e-mail); the controls are disabled and the reason is shown. */
  disabledReason?: string | undefined;
};

function useAccountForm(action: Action) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  // The passwords are never sent back, so a done form is emptied rather than left with old values.
  useEffect(() => {
    if (state?.status === 'success') form.current?.reset();
  }, [state]);
  // Submitted from code, so the form keeps what was typed when the server refuses it.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }
  const issues = state?.status === 'error' ? state.fields : {};
  return { state, pending, form, onSubmit, issues };
}

function Status({ state, texts, done }: { state: AccountState | null; texts: AccountTexts; done: string }) {
  return (
    <>
      <div role="status" className="contents">
        {state?.status === 'success' && (
          <p className="rounded-md bg-surface px-4 py-3 font-medium text-success">{done}</p>
        )}
      </div>
      <div role="alert" className="contents">
        {state?.status === 'error' && (
          <p className="rounded-md bg-surface px-4 py-3 font-medium text-error">{texts.errors[state.code]}</p>
        )}
      </div>
    </>
  );
}

const sectionClass = 'flex flex-col gap-5 rounded-lg border border-hairline bg-surface p-5 sm:p-6';

export function PasswordForm({
  action,
  texts,
  title,
  button,
  working,
  done,
  disabledReason,
  labels,
  hint,
}: Common & { labels: { current: string; next: string; confirm: string }; hint: string }) {
  const { state, pending, form, onSubmit, issues } = useAccountForm(action);
  const issue = (field: AccountField) => (issues[field] ? texts.issues[issues[field]] : undefined);
  const off = Boolean(disabledReason);

  return (
    <form ref={form} onSubmit={onSubmit} className={sectionClass} noValidate>
      <h2 className="text-lg font-bold">{title}</h2>
      <TextField
        id="currentPassword"
        name="currentPassword"
        type="password"
        label={labels.current}
        autoComplete="current-password"
        required
        disabled={off}
        error={issue('currentPassword')}
      />
      <div className="flex flex-col gap-1.5">
        <TextField
          id="newPassword"
          name="newPassword"
          type="password"
          label={labels.next}
          autoComplete="new-password"
          required
          disabled={off}
          error={issue('newPassword')}
        />
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <TextField
        id="confirm"
        name="confirm"
        type="password"
        label={labels.confirm}
        autoComplete="new-password"
        required
        disabled={off}
        error={issue('confirm')}
      />
      <Status state={state} texts={texts} done={done} />
      {disabledReason && <p className="text-sm text-muted">{disabledReason}</p>}
      <div>
        <SubmitButton label={button} pendingLabel={working} pending={pending} disabled={off} />
      </div>
    </form>
  );
}

export function EmailForm({
  action,
  locale,
  texts,
  title,
  button,
  working,
  done,
  disabledReason,
  label,
  hint,
}: Common & { locale: string; label: string; hint: string }) {
  const { state, pending, form, onSubmit, issues } = useAccountForm(action);
  const off = Boolean(disabledReason);

  return (
    <form ref={form} onSubmit={onSubmit} className={sectionClass} noValidate>
      <h2 className="text-lg font-bold">{title}</h2>
      <input type="hidden" name="locale" value={locale} />
      <div className="flex flex-col gap-1.5">
        <TextField
          id="email"
          name="email"
          type="email"
          label={label}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={off}
          error={issues.email ? texts.issues[issues.email] : undefined}
        />
        <p className="text-sm text-muted">{hint}</p>
      </div>
      <Status state={state} texts={texts} done={done} />
      {disabledReason && <p className="text-sm text-muted">{disabledReason}</p>}
      <div>
        <SubmitButton label={button} pendingLabel={working} pending={pending} disabled={off} />
      </div>
    </form>
  );
}
