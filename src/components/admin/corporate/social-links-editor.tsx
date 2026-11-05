'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useTransition,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { TextField } from '../../field.tsx';
import { BilingualField } from '../bilingual-field.tsx';
import { ConfirmDelete, type ConfirmDeleteTexts } from '../confirm-delete.tsx';
import { FormStatus } from '../form-status.tsx';
import { SubmitButton } from '../submit-button.tsx';
import { fieldMessage, type FormTexts } from '../texts.ts';

type SocialLinksTexts = {
  title: string;
  description: string;
  empty: string;
  add: string;
  platform: string;
  platformHint: string;
  label: string;
  url: string;
  moveUp: string;
  moveDown: string;
  reordered: string;
  delete: ConfirmDeleteTexts;
};

type Action = (previous: FormState | null, formData: FormData) => Promise<FormState>;

type Link = { id: string; platform: string; label: { tr: string; en: string }; url: string };

type Props = {
  links: Link[];
  locale: string;
  createAction: Action;
  updateAction: Action;
  deleteAction: Action;
  reorder: (ids: string[]) => Promise<FormState>;
  texts: SocialLinksTexts;
  formTexts: FormTexts;
  disabledReason?: string | undefined;
};

// Keep in sync with socialLinkSchema in src/server/content/schemas.ts.
const LIMITS = { platform: 40, label: 60, url: 2048 };

const iconButton =
  'grid size-touch place-items-center rounded-md border border-hairline bg-surface text-ink hover:border-accent hover:text-accent-text aria-disabled:cursor-not-allowed aria-disabled:text-muted aria-disabled:hover:border-hairline aria-disabled:hover:text-muted';

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
      <path
        d={up ? 'M3 10.5l5-5 5 5' : 'M3 5.5l5 5 5-5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type LinkFormProps = {
  link?: Link;
  action: Action;
  texts: SocialLinksTexts;
  formTexts: FormTexts;
  disabledReason?: string | undefined;
  children?: ReactNode;
};

function LinkForm({ link, action, texts, formTexts, disabledReason, children }: LinkFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const form = useRef<HTMLFormElement>(null);
  const errors = state?.status === 'error' ? state.fieldErrors : {};
  const message = (field: string) => fieldMessage(formTexts, errors[field]);
  const prefix = `link-${link?.id ?? 'new'}`;

  useEffect(() => {
    if (!link && state?.status === 'success') form.current?.reset();
  }, [link, state]);

  // Called from code, not as the form action, so the typed values stay after a refusal.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form ref={form} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {link && <input type="hidden" name="id" value={link.id} />}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <TextField
            id={`${prefix}-platform`}
            name="platform"
            label={texts.platform}
            defaultValue={link?.platform ?? ''}
            maxLength={LIMITS.platform}
            required
            error={message('platform')}
          />
          <p className="mt-1.5 text-sm text-muted">{texts.platformHint}</p>
        </div>
        <TextField
          id={`${prefix}-url`}
          name="url"
          type="url"
          label={texts.url}
          defaultValue={link?.url ?? ''}
          maxLength={LIMITS.url}
          required
          error={message('url')}
        />
      </div>
      <BilingualField
        name="label"
        idPrefix={`${prefix}-label`}
        label={texts.label}
        languages={formTexts.languages}
        defaultValue={link?.label}
        maxLength={LIMITS.label}
        errors={{ tr: message('label.tr'), en: message('label.en') }}
      />
      <FormStatus state={state} texts={formTexts} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton
          label={link ? formTexts.save : texts.add}
          pendingLabel={formTexts.saving}
          pending={pending}
          disabled={Boolean(disabledReason)}
        />
        {children}
      </div>
    </form>
  );
}

export function SocialLinksEditor({
  links,
  locale,
  createAction,
  updateAction,
  deleteAction,
  reorder,
  texts,
  formTexts,
  disabledReason,
}: Props) {
  const [result, runReorder] = useActionState(async (_previous: FormState | null, ids: string[]) => reorder(ids), null);
  const [, startReorder] = useTransition();

  function move(index: number, step: -1 | 1) {
    const target = index + step;
    if (disabledReason || target < 0 || target >= links.length) return;
    const next = links.map((link) => link.id);
    [next[index], next[target]] = [next[target]!, next[index]!];
    startReorder(() => runReorder(next));
  }

  return (
    <section aria-labelledby="social-links" className="flex flex-col gap-4">
      <div>
        <h2 id="social-links" className="text-lg font-bold">
          {texts.title}
        </h2>
        <p className="text-muted">{texts.description}</p>
      </div>
      {links.length === 0 ? (
        <p className="rounded-lg border border-hairline bg-surface px-5 py-10 text-center text-muted">{texts.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {links.map((link, index) => (
            <li key={link.id} className="rounded-lg border border-hairline bg-surface p-5 sm:p-6">
              <LinkForm
                link={link}
                action={updateAction}
                texts={texts}
                formTexts={formTexts}
                disabledReason={disabledReason}
              >
                <button
                  type="button"
                  aria-label={`${texts.moveUp}: ${link.platform}`}
                  aria-disabled={index === 0 || Boolean(disabledReason)}
                  onClick={() => move(index, -1)}
                  className={iconButton}
                >
                  <Arrow up />
                </button>
                <button
                  type="button"
                  aria-label={`${texts.moveDown}: ${link.platform}`}
                  aria-disabled={index === links.length - 1 || Boolean(disabledReason)}
                  onClick={() => move(index, 1)}
                  className={iconButton}
                >
                  <Arrow up={false} />
                </button>
              </LinkForm>
              <div className="mt-3">
                <ConfirmDelete
                  name={link.platform}
                  fields={{ id: link.id, locale }}
                  action={deleteAction}
                  texts={texts.delete}
                  formTexts={formTexts}
                  disabledReason={disabledReason}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormStatus state={result} texts={formTexts} successText={texts.reordered} />
      <div className="rounded-lg border border-hairline bg-surface p-5 sm:p-6">
        <h3 className="mb-4 text-base font-bold">{texts.add}</h3>
        <LinkForm action={createAction} texts={texts} formTexts={formTexts} disabledReason={disabledReason} />
      </div>
      {disabledReason && <p className="text-sm text-muted">{disabledReason}</p>}
    </section>
  );
}
