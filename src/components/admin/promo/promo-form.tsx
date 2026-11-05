'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import { Link } from '../../../i18n/navigation.ts';
import type { FormState } from '../../../server/admin/form.ts';
import { SelectField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { ImageAltField } from '../image-alt-field.tsx';
import { FormActions } from '../form-actions.tsx';
import { ImageField, type MediaTexts, type UploadAction } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type PromoFormTexts = {
  image: string;
  title: string;
  subtitle: string;
  catalog: string;
  noCatalogs: string;
  cancel: string;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  upload: UploadAction;
  locale: string;
  initial?: {
    id: string;
    imageUrl: string;
    imageAlt: { tr: string; en: string };
    title: { tr: string; en: string };
    subtitle: { tr: string; en: string };
    catalogId: string;
  };
  catalogs: { value: string; label: string }[];
  texts: PromoFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// Keep in sync with promoBoardSchema in src/server/content/schemas.ts.
const LIMITS = { title: 100, subtitle: 120 };

export function PromoForm({
  action,
  upload,
  locale,
  initial,
  catalogs,
  texts,
  formTexts,
  mediaTexts,
  readOnlyReason,
  uploadDisabledReason,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);

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
        <ImageField
          id="imageUrl"
          name="imageUrl"
          label={texts.image}
          defaultValue={initial?.imageUrl ?? ''}
          upload={upload}
          texts={mediaTexts}
          errors={formTexts.errors}
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
          name="subtitle"
          label={texts.subtitle}
          languages={formTexts.languages}
          defaultValue={initial?.subtitle}
          maxLength={LIMITS.subtitle}
          optional
          errors={{ tr: message('subtitle.tr'), en: message('subtitle.en') }}
        />
        {catalogs.length === 0 ? (
          <p className="text-sm text-muted">{texts.noCatalogs}</p>
        ) : (
          <SelectField
            id="catalogId"
            name="catalogId"
            label={texts.catalog}
            defaultValue={initial?.catalogId ?? catalogs[0]?.value}
            options={catalogs}
            error={message('catalogId')}
          />
        )}
      </div>
      <FormActions state={state} texts={formTexts} note={readOnlyReason}>
        <SubmitButton
          label={formTexts.save}
          pendingLabel={formTexts.saving}
          pending={pending}
          disabled={Boolean(readOnlyReason) || catalogs.length === 0}
        />
        <Link
          prefetch={false}
          href="/dashboard/promo-boards"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </FormActions>
    </form>
  );
}
