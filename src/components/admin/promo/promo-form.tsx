'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import { Link } from '../../../i18n/navigation.ts';
import type { FormState } from '../../../server/admin/form.ts';
import { SelectField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { FormStatus } from '../form-status.tsx';
import { ImageField, type MediaTexts } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type PromoFormTexts = {
  image: string;
  title: string;
  subtitle: string;
  catalog: string;
  /** Said instead of the select while there is no catalog to link. */
  noCatalogs: string;
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
    title: { tr: string; en: string };
    subtitle: { tr: string; en: string };
    catalogId: string;
  };
  catalogs: { value: string; label: string }[];
  texts: PromoFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  maxBytes: number;
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// The limits of promoBoardSchema in src/server/content/schemas.ts, which stays the authority.
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
      <FormStatus state={state} texts={formTexts} />
      {readOnlyReason && <p className="text-sm text-muted">{readOnlyReason}</p>}
      <div className="flex flex-wrap gap-3">
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
      </div>
    </form>
  );
}
