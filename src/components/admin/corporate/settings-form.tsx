'use client';

import { useActionState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { TextField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { FormStatus } from '../form-status.tsx';
import { ImageField, type MediaTexts } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type SettingsFormTexts = {
  logo: string;
  logoHint: string;
  siteName: string;
  phone: string;
  email: string;
  address: string;
  workingHours: string;
  serviceArea: string;
  languages: string;
  business: string;
  contact: string;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;
type Pair = { tr: string; en: string };

type Props = {
  action: Action;
  upload: Action;
  initial: {
    siteName: Pair;
    logoUrl: string | null;
    phone: string;
    email: string;
    address: Pair;
    workingHours: Pair;
    serviceArea: Pair;
    languages: Pair;
  };
  texts: SettingsFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  maxBytes: number;
  /** The demo's reason for a read-only form, or why uploads are off. */
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// The limits of siteSettingsSchema in src/server/content/schemas.ts, which stays the authority.
const LIMITS = {
  siteName: 100,
  phone: 30,
  email: 254,
  address: 300,
  workingHours: 200,
  serviceArea: 200,
  languages: 100,
};

const sectionClass = 'flex flex-col gap-6 rounded-lg border border-hairline bg-surface p-5 sm:p-6';

export function SettingsForm({
  action,
  upload,
  initial,
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
  const pair = (name: string) => ({ tr: message(`${name}.tr`), en: message(`${name}.en`) });

  // Submitted from code, not as the form's action, so the form keeps what was typed when the server refuses it.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      <section aria-labelledby="settings-business" className={sectionClass}>
        <h2 id="settings-business" className="text-lg font-bold">
          {texts.business}
        </h2>
        <ImageField
          id="logoUrl"
          name="logoUrl"
          label={texts.logo}
          defaultValue={initial.logoUrl ?? ''}
          upload={upload}
          texts={mediaTexts}
          errors={formTexts.errors}
          maxBytes={maxBytes}
          disabledReason={readOnlyReason ?? uploadDisabledReason}
          error={message('logoUrl')}
        />
        <p className="-mt-3 text-sm text-muted">{texts.logoHint}</p>
        <BilingualField
          name="siteName"
          label={texts.siteName}
          languages={formTexts.languages}
          defaultValue={initial.siteName}
          maxLength={LIMITS.siteName}
          errors={pair('siteName')}
        />
        <BilingualField
          name="languages"
          label={texts.languages}
          languages={formTexts.languages}
          defaultValue={initial.languages}
          maxLength={LIMITS.languages}
          errors={pair('languages')}
        />
      </section>
      <section aria-labelledby="settings-contact" className={sectionClass}>
        <h2 id="settings-contact" className="text-lg font-bold">
          {texts.contact}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            id="phone"
            name="phone"
            type="tel"
            label={texts.phone}
            defaultValue={initial.phone}
            maxLength={LIMITS.phone}
            required
            error={message('phone')}
          />
          <TextField
            id="email"
            name="email"
            type="email"
            label={texts.email}
            defaultValue={initial.email}
            maxLength={LIMITS.email}
            required
            error={message('email')}
          />
        </div>
        <BilingualField
          name="address"
          label={texts.address}
          languages={formTexts.languages}
          defaultValue={initial.address}
          maxLength={LIMITS.address}
          multiline
          errors={pair('address')}
        />
        <BilingualField
          name="workingHours"
          label={texts.workingHours}
          languages={formTexts.languages}
          defaultValue={initial.workingHours}
          maxLength={LIMITS.workingHours}
          errors={pair('workingHours')}
        />
        <BilingualField
          name="serviceArea"
          label={texts.serviceArea}
          languages={formTexts.languages}
          defaultValue={initial.serviceArea}
          maxLength={LIMITS.serviceArea}
          errors={pair('serviceArea')}
        />
      </section>
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
