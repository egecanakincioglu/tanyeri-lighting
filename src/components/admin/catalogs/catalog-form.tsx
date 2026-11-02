'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { BilingualField } from '../bilingual-field.tsx';
import { FormStatus } from '../form-status.tsx';
import { FileField, ImageField, type MediaTexts } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type CatalogFormTexts = { name: string; pdf: string; cover: string; cancel: string };

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  upload: Action;
  locale: string;
  /** Set when editing. */
  initial?: {
    id: string;
    name: { tr: string; en: string };
    pdfUrl: string;
    coverImageUrl: string;
  };
  texts: CatalogFormTexts;
  formTexts: FormTexts;
  /** The hint of the picture field differs from the file field's, so each has its own texts. */
  imageTexts: MediaTexts;
  fileTexts: MediaTexts;
  maxBytes: number;
  /** The demo's reason for a read-only form, or why uploads are off. */
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// The limit of catalogSchema in src/server/content/schemas.ts, which stays the authority.
const NAME_LIMIT = 120;

export function CatalogForm({
  action,
  upload,
  locale,
  initial,
  texts,
  formTexts,
  imageTexts,
  fileTexts,
  maxBytes,
  readOnlyReason,
  uploadDisabledReason,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);
  const disabledReason = readOnlyReason ?? uploadDisabledReason;

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
          maxLength={NAME_LIMIT}
          errors={{ tr: message('name.tr'), en: message('name.en') }}
        />
        <FileField
          id="pdfUrl"
          name="pdfUrl"
          label={texts.pdf}
          defaultValue={initial?.pdfUrl ?? ''}
          upload={upload}
          texts={fileTexts}
          errors={formTexts.errors}
          maxBytes={maxBytes}
          disabledReason={disabledReason}
          error={message('pdfUrl') ?? message('sizeBytes')}
        />
        <ImageField
          id="coverImageUrl"
          name="coverImageUrl"
          label={texts.cover}
          defaultValue={initial?.coverImageUrl ?? ''}
          upload={upload}
          texts={imageTexts}
          errors={formTexts.errors}
          maxBytes={maxBytes}
          portrait
          disabledReason={disabledReason}
          error={message('coverImageUrl')}
        />
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
          href="/dashboard/catalogs"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </div>
    </form>
  );
}
