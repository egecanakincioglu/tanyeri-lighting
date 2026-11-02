'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { BilingualField } from '../bilingual-field.tsx';
import { FormStatus } from '../form-status.tsx';
import { MarkdownField } from '../markdown-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  pageKey: string;
  initial: { title: { tr: string; en: string }; body: { tr: string; en: string } };
  texts: { title: string; body: string; hideNote: string; cancel: string };
  markdownTexts: { hint: string; edit: string; preview: string; loading: string };
  formTexts: FormTexts;
  /** The demo's reason for a read-only form. */
  readOnlyReason?: string | undefined;
};

// The limits of legalPageSchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = { title: 150, body: 50_000 };

export function LegalForm({ action, pageKey, initial, texts, markdownTexts, formTexts, readOnlyReason }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);

  // Submitted from code, so the form keeps what was typed when the server refuses it.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="pageKey" value={pageKey} />
      <div className="flex flex-col gap-6 rounded-lg border border-hairline bg-surface p-5 sm:p-6">
        <BilingualField
          name="title"
          label={texts.title}
          languages={formTexts.languages}
          defaultValue={initial.title}
          maxLength={LIMITS.title}
          required={false}
          errors={{ tr: message('title.tr'), en: message('title.en') }}
        />
        {(['tr', 'en'] as const).map((language) => (
          <fieldset key={language} className="min-w-0" lang={language}>
            <legend className="mb-2 text-base font-bold">
              {texts.body}: {formTexts.languages[language]}
            </legend>
            <MarkdownField
              id={`body-${language}`}
              name={`body.${language}`}
              label={formTexts.languages[language]}
              defaultValue={initial.body[language]}
              maxLength={LIMITS.body}
              required={false}
              error={message(`body.${language}`)}
              texts={markdownTexts}
            />
          </fieldset>
        ))}
      </div>
      <p className="text-sm text-muted">{texts.hideNote}</p>
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
          href="/dashboard/legal-pages"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </div>
    </form>
  );
}
