'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { BilingualField } from '../bilingual-field.tsx';
import { BilingualMarkdownField } from '../bilingual-markdown-field.tsx';
import { FormActions } from '../form-actions.tsx';
import { ImageField, type MediaTexts, type UploadAction } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type ProjectFormTexts = { title: string; description: string; before: string; after: string; cancel: string };

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Pair = { tr: string; en: string };

type Props = {
  action: Action;
  upload: UploadAction;
  locale: string;
  /** Set when editing. */
  initial?: { id: string; title: Pair; description: Pair; beforeImageUrl: string; afterImageUrl: string };
  texts: ProjectFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  markdownTexts: { hint: string; edit: string; preview: string; loading: string };
  /** The demo's reason for a read-only form, or why uploads are off. */
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// The limits of projectSchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = { title: 150, description: 5000 };

export function ProjectForm({
  action,
  upload,
  locale,
  initial,
  texts,
  formTexts,
  mediaTexts,
  markdownTexts,
  readOnlyReason,
  uploadDisabledReason,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);

  // Submitted from code, not as the form's action, so the form keeps what was typed when the server refuses it.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const imageProps = {
    upload,
    texts: mediaTexts,
    errors: formTexts.errors,
    disabledReason: readOnlyReason ?? uploadDisabledReason,
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="flex flex-col gap-8 rounded-lg border border-hairline bg-surface p-5 sm:p-8">
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
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageField
            id="beforeImageUrl"
            name="beforeImageUrl"
            label={texts.before}
            defaultValue={initial?.beforeImageUrl ?? ''}
            error={message('beforeImageUrl')}
            {...imageProps}
          />
          <ImageField
            id="afterImageUrl"
            name="afterImageUrl"
            label={texts.after}
            defaultValue={initial?.afterImageUrl ?? ''}
            error={message('afterImageUrl')}
            {...imageProps}
          />
        </div>
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
          href="/dashboard/projects"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </FormActions>
    </form>
  );
}
