'use client';

import { useActionState, useState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { FormActions } from '../form-actions.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';
import { TextAreaField, TextField } from '../../field.tsx';

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  pageKey: string;
  initial: { title: { tr: string; en: string }; description: { tr: string; en: string } };
  texts: {
    title: string;
    description: string;
    /** Hold `{count}` and `{max}`; the second is said when the text is longer than recommended. */
    counter: string;
    counterOver: string;
    cancel: string;
  };
  formTexts: FormTexts;
  readOnlyReason?: string | undefined;
};

// The limits of pageMetadataSchema in src/server/content/schemas.ts stay the authority; these are the lengths search
// engines show before they cut a title or a description.
const RECOMMENDED = { title: 60, description: 155 };
const LIMITS = { title: 120, description: 320 };

function Counter({ id, count, max, texts }: { id: string; count: number; max: number; texts: Props['texts'] }) {
  const over = count > max;
  const text = (over ? texts.counterOver : texts.counter)
    .replace('{count}', String(count))
    .replace('{max}', String(max));
  return (
    <p id={id} className={`text-sm ${over ? 'font-medium text-error' : 'text-muted'}`}>
      {text}
    </p>
  );
}

export function SeoForm({ action, pageKey, initial, texts, formTexts, readOnlyReason }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [values, setValues] = useState({
    'title.tr': initial.title.tr,
    'title.en': initial.title.en,
    'description.tr': initial.description.tr,
    'description.en': initial.description.en,
  });
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="pageKey" value={pageKey} />
      <div className="flex flex-col gap-8 rounded-lg border border-hairline bg-surface p-5 sm:p-8">
        {(['title', 'description'] as const).map((field) => (
          <fieldset key={field} className="min-w-0">
            <legend className="mb-2 text-base font-bold">{texts[field]}</legend>
            <div className="grid gap-4 md:grid-cols-2">
              {(['tr', 'en'] as const).map((language) => {
                const name = `${field}.${language}` as const;
                const id = `${field}-${language}`;
                const Field = field === 'title' ? TextField : TextAreaField;
                return (
                  <div key={language} className="flex flex-col gap-1.5">
                    <Field
                      id={id}
                      name={name}
                      label={formTexts.languages[language]}
                      lang={language}
                      value={values[name]}
                      maxLength={LIMITS[field]}
                      required
                      error={message(name)}
                      aria-describedby={message(name) ? `${id}-error ${id}-count` : `${id}-count`}
                      onChange={(event) => setValues({ ...values, [name]: event.target.value })}
                    />
                    <Counter id={`${id}-count`} count={values[name].length} max={RECOMMENDED[field]} texts={texts} />
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
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
          href="/dashboard/seo"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </FormActions>
    </form>
  );
}
