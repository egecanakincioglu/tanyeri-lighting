'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { TextField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { FormStatus } from '../form-status.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type CategoryFormTexts = { key: string; keyHint: string; name: string; cancel: string };

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  locale: string;
  /** Set when editing. */
  initial?: { id: string; key: string; name: { tr: string; en: string } };
  texts: CategoryFormTexts;
  formTexts: FormTexts;
  /** The demo's reason for a read-only form. */
  readOnlyReason?: string | undefined;
};

// The limits of categorySchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = { key: 60, name: 60 };

export function CategoryForm({ action, locale, initial, texts, formTexts, readOnlyReason }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);

  // Submitted from code, not as the form's action, so the form keeps what was typed when the server refuses it.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="flex flex-col gap-6 rounded-lg border border-hairline bg-surface p-5 sm:p-6">
        <BilingualField
          name="name"
          label={texts.name}
          languages={formTexts.languages}
          defaultValue={initial?.name}
          maxLength={LIMITS.name}
          errors={{ tr: message('name.tr'), en: message('name.en') }}
        />
        <div className="flex flex-col gap-2">
          <TextField
            id="key"
            name="key"
            label={texts.key}
            defaultValue={initial?.key ?? ''}
            maxLength={LIMITS.key}
            autoCapitalize="none"
            spellCheck={false}
            required
            error={message('key')}
            aria-describedby={message('key') ? 'key-error key-hint' : 'key-hint'}
          />
          <p id="key-hint" className="text-sm text-muted">
            {texts.keyHint}
          </p>
        </div>
      </div>
      <FormStatus state={state} texts={formTexts} />
      {readOnlyReason && <p className="text-sm text-muted">{readOnlyReason}</p>}
      <div className="flex flex-wrap gap-3">
        <SubmitButton
          label={formTexts.save}
          pendingLabel={formTexts.saving}
          pending={pending}
          disabled={Boolean(readOnlyReason)}
        />
        <Link
          prefetch={false}
          href="/dashboard/categories"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </div>
    </form>
  );
}
