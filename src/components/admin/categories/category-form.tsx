'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { TextField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { FormActions } from '../form-actions.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type CategoryFormTexts = {
  key: string;
  keyHint: string;
  name: string;
  seoTitle: string;
  seoDescription: string;
  h1: string;
  intro: string;
  /** Said once above the four optional fields of the category's own page. */
  pageHint: string;
  cancel: string;
};

type Pair = { tr: string; en: string };

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  locale: string;
  /** Set when editing. */
  initial?: { id: string; key: string; name: Pair; seoTitle: Pair; seoDescription: Pair; h1: Pair; intro: Pair };
  texts: CategoryFormTexts;
  formTexts: FormTexts;
  /** The demo's reason for a read-only form. */
  readOnlyReason?: string | undefined;
};

// The limits of categorySchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = { key: 60, name: 60, seoTitle: 70, seoDescription: 320, h1: 100, intro: 600 };

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
      <div className="flex flex-col gap-8 rounded-lg border border-hairline bg-surface p-5 sm:p-8">
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
      <div className="flex flex-col gap-8 rounded-lg border border-hairline bg-surface p-5 sm:p-8">
        <p className="text-sm text-muted">{texts.pageHint}</p>
        <BilingualField
          name="seoTitle"
          label={texts.seoTitle}
          languages={formTexts.languages}
          defaultValue={initial?.seoTitle}
          maxLength={LIMITS.seoTitle}
          optional
          errors={{ tr: message('seoTitle.tr'), en: message('seoTitle.en') }}
          error={message('seoTitle')}
        />
        <BilingualField
          name="seoDescription"
          label={texts.seoDescription}
          languages={formTexts.languages}
          defaultValue={initial?.seoDescription}
          maxLength={LIMITS.seoDescription}
          multiline
          optional
          errors={{ tr: message('seoDescription.tr'), en: message('seoDescription.en') }}
          error={message('seoDescription')}
        />
        <BilingualField
          name="h1"
          label={texts.h1}
          languages={formTexts.languages}
          defaultValue={initial?.h1}
          maxLength={LIMITS.h1}
          optional
          errors={{ tr: message('h1.tr'), en: message('h1.en') }}
          error={message('h1')}
        />
        <BilingualField
          name="intro"
          label={texts.intro}
          languages={formTexts.languages}
          defaultValue={initial?.intro}
          maxLength={LIMITS.intro}
          multiline
          optional
          errors={{ tr: message('intro.tr'), en: message('intro.en') }}
          error={message('intro')}
        />
      </div>
      <FormActions state={state} texts={formTexts} note={readOnlyReason}>
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
      </FormActions>
    </form>
  );
}
