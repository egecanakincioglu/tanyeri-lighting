'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { BilingualField } from '../bilingual-field.tsx';
import { BilingualMarkdownField } from '../bilingual-markdown-field.tsx';
import { FormStatus } from '../form-status.tsx';
import { ImageField, type MediaTexts } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type ServiceFormTexts = {
  image: string;
  title: string;
  description: string;
  note: string;
  noteHint: string;
  noteBoth: string;
  cancel: string;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Pair = { tr: string; en: string };

type Props = {
  action: Action;
  upload: Action;
  locale: string;
  /** Set when editing. */
  initial?: { id: string; imageUrl: string; title: Pair; description: Pair; note: Pair };
  texts: ServiceFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  markdownTexts: { hint: string; edit: string; preview: string; loading: string };
  maxBytes: number;
  /** The demo's reason for a read-only form, or why uploads are off. */
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// The limits of serviceSchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = { title: 100, description: 5000, note: 500 };

export function ServiceForm({
  action,
  upload,
  locale,
  initial,
  texts,
  formTexts,
  mediaTexts,
  markdownTexts,
  maxBytes,
  readOnlyReason,
  uploadDisabledReason,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);
  // The note is filled in both languages or in neither; the schema reports a half-filled pair on `note`.
  const noteError = errors['note'] ? texts.noteBoth : undefined;

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
        <ImageField
          id="imageUrl"
          name="imageUrl"
          label={texts.image}
          defaultValue={initial?.imageUrl ?? ''}
          upload={upload}
          texts={mediaTexts}
          errors={formTexts.errors}
          maxBytes={maxBytes}
          disabledReason={readOnlyReason ?? uploadDisabledReason}
          error={message('imageUrl')}
        />
        <BilingualField
          name="title"
          label={texts.title}
          languages={formTexts.languages}
          defaultValue={initial?.title}
          maxLength={LIMITS.title}
          errors={{ tr: message('title.tr'), en: message('title.en') }}
        />
        <BilingualMarkdownField
          name="description"
          label={texts.description}
          languages={formTexts.languages}
          defaultValue={initial?.description}
          maxLength={LIMITS.description}
          errors={{ tr: message('description.tr'), en: message('description.en') }}
          texts={markdownTexts}
        />
        <div className="flex flex-col gap-2">
          <BilingualField
            name="note"
            label={texts.note}
            languages={formTexts.languages}
            defaultValue={initial?.note}
            maxLength={LIMITS.note}
            optional
            errors={{ tr: message('note.tr'), en: message('note.en') }}
            error={noteError}
          />
          <p className="text-sm text-muted">{texts.noteHint}</p>
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
          href="/dashboard/services"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </div>
    </form>
  );
}
