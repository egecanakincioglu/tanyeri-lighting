'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { BilingualField } from '../bilingual-field.tsx';
import { ImageAltField } from '../image-alt-field.tsx';
import { FormActions } from '../form-actions.tsx';
import { FileField, ImageField, type MediaTexts, type UploadAction } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type CatalogFormTexts = { name: string; pdf: string; cover: string; cancel: string };

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  upload: UploadAction;
  locale: string;
  initial?: {
    id: string;
    name: { tr: string; en: string };
    pdfUrl: string;
    coverImageUrl: string;
    imageAlt: { tr: string; en: string };
  };
  texts: CatalogFormTexts;
  formTexts: FormTexts;
  imageTexts: MediaTexts;
  fileTexts: MediaTexts;
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// Keep in sync with catalogSchema in src/server/content/schemas.ts.
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
  readOnlyReason,
  uploadDisabledReason,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);
  const disabledReason = readOnlyReason ?? uploadDisabledReason;

  // Called from code, not as the form action, so the typed values stay after a refusal.
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
          portrait
          disabledReason={disabledReason}
          error={message('coverImageUrl')}
        />
        <ImageAltField texts={formTexts} defaultValue={initial?.imageAlt} errors={errors} />
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
          href="/dashboard/catalogs"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </FormActions>
    </form>
  );
}
