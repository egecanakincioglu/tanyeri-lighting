'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import type { HomeBanner } from '../../../server/content/schemas.ts';
import { SelectField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { ImageAltField } from '../image-alt-field.tsx';
import { FormStatus } from '../form-status.tsx';
import { ImageField, type MediaTexts } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type BannerFormTexts = {
  image: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryTarget: string;
  secondaryLabel: string;
  secondaryTarget: string;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  upload: Action;
  initial: HomeBanner;
  /** The public pages a button can open, with their names in the language of the panel. */
  targets: { value: string; label: string }[];
  texts: BannerFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  maxBytes: number;
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// The limits of homeBannerSchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = { title: 120, description: 400, label: 40 };

export function BannerForm({
  action,
  upload,
  initial,
  targets,
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

  const buttons = [
    { name: 'primary', label: texts.primaryLabel, target: texts.primaryTarget, value: initial.primaryAction },
    { name: 'secondary', label: texts.secondaryLabel, target: texts.secondaryTarget, value: initial.secondaryAction },
  ] as const;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-6 rounded-lg border border-hairline bg-surface p-5 sm:p-6">
        <ImageField
          id="imageUrl"
          name="imageUrl"
          label={texts.image}
          defaultValue={initial.imageUrl}
          upload={upload}
          texts={mediaTexts}
          errors={formTexts.errors}
          maxBytes={maxBytes}
          disabledReason={readOnlyReason ?? uploadDisabledReason}
          error={message('imageUrl')}
        />
        <ImageAltField texts={formTexts} defaultValue={initial.imageAlt} errors={errors} />
        <BilingualField
          name="title"
          label={texts.title}
          languages={formTexts.languages}
          defaultValue={initial.title}
          maxLength={LIMITS.title}
          errors={{ tr: message('title.tr'), en: message('title.en') }}
        />
        <BilingualField
          name="description"
          label={texts.description}
          languages={formTexts.languages}
          defaultValue={initial.description}
          maxLength={LIMITS.description}
          multiline
          errors={{ tr: message('description.tr'), en: message('description.en') }}
        />
      </div>
      {buttons.map((button) => (
        <div key={button.name} className="flex flex-col gap-6 rounded-lg border border-hairline bg-surface p-5 sm:p-6">
          <BilingualField
            name={`${button.name}Label`}
            label={button.label}
            languages={formTexts.languages}
            defaultValue={button.value.label}
            maxLength={LIMITS.label}
            errors={{
              tr: message(`${button.name}Action.label.tr`),
              en: message(`${button.name}Action.label.en`),
            }}
          />
          <SelectField
            id={`${button.name}Target`}
            name={`${button.name}Target`}
            label={button.target}
            defaultValue={button.value.target}
            options={targets}
            error={message(`${button.name}Action.target`)}
          />
        </div>
      ))}
      <FormStatus state={state} texts={formTexts} />
      {readOnlyReason && <p className="text-sm text-muted">{readOnlyReason}</p>}
      <div>
        <SubmitButton
          label={formTexts.save}
          pendingLabel={formTexts.saving}
          pending={pending}
          disabled={Boolean(readOnlyReason)}
        />
      </div>
    </form>
  );
}
