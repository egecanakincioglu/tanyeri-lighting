'use client';

import { useActionState, useState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { slugify } from '../../../lib/slugify.ts';
import { TextField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { FormActions } from '../form-actions.tsx';
import { ImageField, type MediaTexts, type UploadAction } from '../media-field.tsx';
import { SelectField } from '../select-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type Pair = { tr: string; en: string };

type ProductFormTexts = {
  image: string;
  category: string;
  slug: string;
  slugHint: string;
  slugRedirectHint: string;
  code: string;
  name: string;
  color: string;
  material: string;
  power: string;
  dimensions: string;
  description: string;
  luminousFlux: string;
  colorTemperature: string;
  cri: string;
  ip: string;
  cancel: string;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  upload: UploadAction;
  locale: string;
  categories: readonly { value: string; label: string }[];
  initial?: {
    id: string;
    categoryId: string;
    slug: string;
    code: string;
    name: Pair;
    color: Pair;
    material: Pair;
    power: string;
    dimensions: string;
    description: Pair;
    luminousFlux: string;
    colorTemperature: string;
    cri: string;
    ip: string;
    imageUrl: string;
  };
  texts: ProductFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// Keep in sync with productSchema in src/server/content/schemas.ts.
const LIMITS = {
  slug: 80,
  code: 60,
  name: 120,
  color: 60,
  material: 100,
  power: 40,
  dimensions: 60,
  description: 500,
  detail: 20,
};

export function ProductForm({
  action,
  upload,
  locale,
  categories,
  initial,
  texts,
  formTexts,
  mediaTexts,
  readOnlyReason,
  uploadDisabledReason,
}: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [slug, setSlug] = useState(initial?.slug ?? '');
  // A new address follows the Turkish name until edited by hand; a stored address is never rewritten.
  const [slugEdited, setSlugEdited] = useState(Boolean(initial));
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);

  // Called from code, not as the form action, so the typed values stay after a refusal.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  function onInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target as HTMLInputElement;
    if (!slugEdited && target.name === 'name.tr') setSlug(slugify(target.value).slice(0, LIMITS.slug));
  }

  const slugHint = initial ? `${texts.slugHint} ${texts.slugRedirectHint}` : texts.slugHint;

  return (
    <form onSubmit={onSubmit} onInput={onInput} className="flex flex-col gap-6" noValidate>
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
        <SelectField
          id="categoryId"
          name="categoryId"
          label={texts.category}
          options={categories}
          defaultValue={initial?.categoryId ?? categories[0]?.value}
          error={message('categoryId')}
        />
        <BilingualField
          name="name"
          label={texts.name}
          languages={formTexts.languages}
          defaultValue={initial?.name}
          maxLength={LIMITS.name}
          errors={{ tr: message('name.tr'), en: message('name.en') }}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            id="code"
            name="code"
            label={texts.code}
            defaultValue={initial?.code ?? ''}
            maxLength={LIMITS.code}
            required
            error={message('code')}
          />
          <div className="flex flex-col gap-2">
            <TextField
              id="slug"
              name="slug"
              label={texts.slug}
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setSlugEdited(true);
              }}
              maxLength={LIMITS.slug}
              autoCapitalize="none"
              spellCheck={false}
              required
              error={message('slug')}
              aria-describedby={message('slug') ? 'slug-error slug-hint' : 'slug-hint'}
            />
            <p id="slug-hint" className="text-sm text-muted">
              {slugHint}
            </p>
          </div>
        </div>
        <BilingualField
          name="color"
          label={texts.color}
          languages={formTexts.languages}
          defaultValue={initial?.color}
          maxLength={LIMITS.color}
          errors={{ tr: message('color.tr'), en: message('color.en') }}
        />
        <BilingualField
          name="material"
          label={texts.material}
          languages={formTexts.languages}
          defaultValue={initial?.material}
          maxLength={LIMITS.material}
          errors={{ tr: message('material.tr'), en: message('material.en') }}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            id="power"
            name="power"
            label={texts.power}
            defaultValue={initial?.power ?? ''}
            maxLength={LIMITS.power}
            required
            error={message('power')}
          />
          <TextField
            id="dimensions"
            name="dimensions"
            label={texts.dimensions}
            defaultValue={initial?.dimensions ?? ''}
            maxLength={LIMITS.dimensions}
            required
            error={message('dimensions')}
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {(
            [
              ['luminousFlux', texts.luminousFlux, initial?.luminousFlux],
              ['colorTemperature', texts.colorTemperature, initial?.colorTemperature],
              ['cri', texts.cri, initial?.cri],
              ['ip', texts.ip, initial?.ip],
            ] as const
          ).map(([name, label, value]) => (
            <TextField
              key={name}
              id={name}
              name={name}
              label={label}
              defaultValue={value ?? ''}
              maxLength={LIMITS.detail}
              error={message(name)}
            />
          ))}
        </div>
        <BilingualField
          name="description"
          label={texts.description}
          languages={formTexts.languages}
          defaultValue={initial?.description}
          multiline
          optional
          maxLength={LIMITS.description}
          errors={{ tr: message('description.tr'), en: message('description.en') }}
          error={message('description')}
        />
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
          href="/dashboard/products"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </FormActions>
    </form>
  );
}
