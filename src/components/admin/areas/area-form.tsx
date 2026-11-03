'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import { Link } from '../../../i18n/navigation.ts';
import type { FormState } from '../../../server/admin/form.ts';
import { BilingualField } from '../bilingual-field.tsx';
import { ImageAltField } from '../image-alt-field.tsx';
import { FormActions } from '../form-actions.tsx';
import { ImageField, type MediaTexts } from '../media-field.tsx';
import { SelectField } from '../select-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type AreaFormTexts = {
  image: string;
  title: string;
  description: string;
  category: string;
  categoryHint: string;
  cancel: string;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  upload: Action;
  locale: string;
  /** Set when editing. */
  initial?: {
    id: string;
    imageUrl: string;
    imageAlt: { tr: string; en: string };
    title: { tr: string; en: string };
    description: { tr: string; en: string };
    categoryId: string | null;
  };
  categories: readonly { value: string; label: string }[];
  texts: AreaFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  maxBytes: number;
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// The limits of applicationAreaSchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = { title: 100, description: 300 };

export function AreaForm({
  action,
  upload,
  locale,
  initial,
  categories,
  texts,
  formTexts,
  mediaTexts,
  maxBytes,
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

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="flex flex-col gap-8 rounded-lg border border-hairline bg-surface p-5 sm:p-8">
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
        <ImageAltField texts={formTexts} defaultValue={initial?.imageAlt} errors={errors} />
        <BilingualField
          name="title"
          label={texts.title}
          languages={formTexts.languages}
          defaultValue={initial?.title}
          maxLength={LIMITS.title}
          errors={{ tr: message('title.tr'), en: message('title.en') }}
        />
        <BilingualField
          name="description"
          label={texts.description}
          languages={formTexts.languages}
          defaultValue={initial?.description}
          maxLength={LIMITS.description}
          multiline
          errors={{ tr: message('description.tr'), en: message('description.en') }}
        />
        <div className="flex flex-col gap-2">
          <SelectField
            id="categoryId"
            name="categoryId"
            label={texts.category}
            options={categories}
            defaultValue={initial?.categoryId ?? ''}
            error={message('categoryId')}
            aria-describedby={message('categoryId') ? 'categoryId-error categoryId-hint' : 'categoryId-hint'}
          />
          <p id="categoryId-hint" className="text-sm text-muted">
            {texts.categoryHint}
          </p>
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
          href="/dashboard/application-areas"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </FormActions>
    </form>
  );
}
