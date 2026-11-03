'use client';

import { useActionState, startTransition, type ComponentProps, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { FormActions } from '../form-actions.tsx';
import { MarkdownField } from '../markdown-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type AboutFormTexts = {
  body: string;
  vision: string;
  markdown: ComponentProps<typeof MarkdownField>['texts'];
};

type Pair = { tr: string; en: string };

type Props = {
  action: (previous: FormState | null, formData: FormData) => Promise<FormState>;
  initial: { body: Pair; vision: Pair };
  texts: AboutFormTexts;
  formTexts: FormTexts;
  /** The demo's reason for a read-only form. */
  readOnlyReason?: string | undefined;
};

// The limit of aboutPageSchema in src/server/content/schemas.ts, which stays the authority.
const MAX_LENGTH = 50_000;

export function AboutForm({ action, initial, texts, formTexts, readOnlyReason }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};

  // Submitted from code, not as the form's action, so the form keeps what was typed when the server refuses it.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {(['body', 'vision'] as const).map((field) => (
        <fieldset
          key={field}
          className="flex min-w-0 flex-col gap-6 rounded-lg border border-hairline bg-surface p-5 sm:p-6"
        >
          <legend className="px-1 text-lg font-bold">{texts[field]}</legend>
          {(['tr', 'en'] as const).map((language) => (
            <MarkdownField
              key={language}
              id={`${field}-${language}`}
              name={`${field}.${language}`}
              label={formTexts.languages[language]}
              defaultValue={initial[field][language]}
              maxLength={MAX_LENGTH}
              error={fieldMessage(formTexts, errors[`${field}.${language}`])}
              texts={texts.markdown}
            />
          ))}
        </fieldset>
      ))}
      <FormActions state={state} texts={formTexts} note={readOnlyReason}>
        <SubmitButton
          label={formTexts.save}
          pendingLabel={formTexts.saving}
          pending={pending}
          disabled={Boolean(readOnlyReason)}
        />
      </FormActions>
    </form>
  );
}
