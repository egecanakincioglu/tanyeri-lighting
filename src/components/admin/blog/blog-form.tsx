'use client';

import { useActionState, useState, startTransition, type FormEvent } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Link } from '../../../i18n/navigation.ts';
import { slugify } from '../../../lib/slugify.ts';
import { TextField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { BilingualMarkdownField } from '../bilingual-markdown-field.tsx';
import { FormActions } from '../form-actions.tsx';
import { ImageField, type MediaTexts, type UploadAction } from '../media-field.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type Pair = { tr: string; en: string };

type BlogFormTexts = {
  image: string;
  imageAlt: string;
  title: string;
  description: string;
  excerpt: string;
  body: string;
  slug: string;
  slugHint: string;
  slugRedirectHint: string;
  publishedAt: string;
  publishedAtHint: string;
  cancel: string;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Props = {
  action: Action;
  upload: UploadAction;
  locale: string;
  /** `publishedAt` is YYYY-MM-DD, or empty for a draft. */
  initial?: {
    id: string;
    slug: string;
    imageUrl: string;
    imageAlt: Pair;
    title: Pair;
    description: Pair;
    excerpt: Pair;
    body: Pair;
    publishedAt: string;
  };
  texts: BlogFormTexts;
  formTexts: FormTexts;
  mediaTexts: MediaTexts;
  markdownTexts: { hint: string; edit: string; preview: string; loading: string };
  readOnlyReason?: string | undefined;
  uploadDisabledReason?: string | undefined;
};

// Keep in sync with blogPostSchema in src/server/content/schemas.ts.
const LIMITS = { slug: 80, title: 120, description: 320, excerpt: 320, body: 50_000, imageAlt: 200 };

export function BlogForm({
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
  const [slug, setSlug] = useState(initial?.slug ?? '');
  // A new address follows the Turkish title until edited by hand; a stored address is never rewritten.
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
    if (!slugEdited && target.name === 'title.tr') setSlug(slugify(target.value).slice(0, LIMITS.slug));
  }

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
        <BilingualField
          name="imageAlt"
          label={texts.imageAlt}
          languages={formTexts.languages}
          defaultValue={initial?.imageAlt}
          maxLength={LIMITS.imageAlt}
          errors={{ tr: message('imageAlt.tr'), en: message('imageAlt.en') }}
        />
        <BilingualField
          name="title"
          label={texts.title}
          languages={formTexts.languages}
          defaultValue={initial?.title}
          maxLength={LIMITS.title}
          errors={{ tr: message('title.tr'), en: message('title.en') }}
        />
        <div className="grid gap-6 md:grid-cols-2">
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
              {initial ? `${texts.slugHint} ${texts.slugRedirectHint}` : texts.slugHint}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <TextField
              id="publishedAt"
              name="publishedAt"
              type="date"
              label={texts.publishedAt}
              defaultValue={initial?.publishedAt ?? ''}
              error={message('publishedAt')}
              aria-describedby={message('publishedAt') ? 'publishedAt-error publishedAt-hint' : 'publishedAt-hint'}
            />
            <p id="publishedAt-hint" className="text-sm text-muted">
              {texts.publishedAtHint}
            </p>
          </div>
        </div>
        <BilingualField
          name="description"
          label={texts.description}
          languages={formTexts.languages}
          defaultValue={initial?.description}
          multiline
          maxLength={LIMITS.description}
          errors={{ tr: message('description.tr'), en: message('description.en') }}
        />
        <BilingualField
          name="excerpt"
          label={texts.excerpt}
          languages={formTexts.languages}
          defaultValue={initial?.excerpt}
          multiline
          maxLength={LIMITS.excerpt}
          errors={{ tr: message('excerpt.tr'), en: message('excerpt.en') }}
        />
        <BilingualMarkdownField
          name="body"
          label={texts.body}
          languages={formTexts.languages}
          defaultValue={initial?.body}
          maxLength={LIMITS.body}
          errors={{ tr: message('body.tr'), en: message('body.en') }}
          texts={markdownTexts}
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
          href="/dashboard/blog"
          className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
        >
          {texts.cancel}
        </Link>
      </FormActions>
    </form>
  );
}
