'use client';

import {
  useActionState,
  useEffect,
  useOptimistic,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from 'react';
import type { FormState } from '../../server/admin/form.ts';
import { Link } from '../../i18n/navigation.ts';
import { SiteImage } from '../site-image.tsx';
import { ActionIcon } from './action-icons.tsx';
import { ConfirmDelete, type ConfirmDeleteTexts } from './confirm-delete.tsx';
import { FormStatus } from './form-status.tsx';
import { AdminIcon } from './icons.tsx';
import type { FormTexts } from './texts.ts';

export type ResourceRow = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** Replaces the delete dialog text for this row. Contains `{name}`. */
  deleteBody?: string;
  edit: ComponentProps<typeof Link>['href'];
};

export type ResourceListTexts = {
  edit: string;
  moveUp: string;
  moveDown: string;
  empty: string;
  reordered: string;
  delete: ConfirmDeleteTexts;
};

type Props = {
  rows: ResourceRow[];
  locale: string;
  texts: ResourceListTexts;
  formTexts: Pick<FormTexts, 'saved' | 'deleted' | 'errors'>;
  /** Without it the rows have no arrows. */
  reorder?: ((ids: string[]) => Promise<FormState>) | undefined;
  portraitImages?: boolean;
  deleteAction: (previous: FormState | null, formData: FormData) => Promise<FormState>;
  disabledReason?: string | undefined;
  createAction?: ReactNode;
};

export const iconButton =
  'grid size-touch place-items-center rounded-md text-muted transition-colors duration-200 hover:bg-hairline/50 hover:text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted motion-reduce:transition-none';

export function Arrow({ up }: { up: boolean }) {
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

export function ResourceList({
  rows,
  locale,
  texts,
  formTexts,
  reorder,
  portraitImages,
  deleteAction,
  disabledReason,
  createAction,
}: Props) {
  const [shown, setShown] = useOptimistic(rows);
  // An action state, so the server's answer arrives together with the end of the optimistic order.
  const [result, runReorder] = useActionState(
    async (_previous: FormState | null, ids: string[]) => (reorder ? reorder(ids) : null),
    null,
  );
  const [, startTransition] = useTransition();
  const [deleted, setDeleted] = useState(false);
  const count = rows.length;

  // The deleted row takes focus with it. The page is inert while the dialog is open,
  // so the first try does nothing; the retry works.
  useEffect(() => {
    if (deleted) document.getElementById('main')?.focus();
  }, [deleted, count]);

  async function deleteRow(previous: FormState | null, formData: FormData) {
    const outcome = await deleteAction(previous, formData);
    if (outcome.status === 'success') setDeleted(true);
    return outcome;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-hairline bg-surface px-5 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent-tint text-accent-text">
          <AdminIcon name="layers" className="size-6" />
        </span>
        <p className="max-w-md text-muted">{texts.empty}</p>
        {createAction}
        {deleted && <FormStatus state={{ status: 'success' }} texts={formTexts} successText={formTexts.deleted} />}
      </div>
    );
  }

  function move(index: number, step: -1 | 1) {
    const target = index + step;
    if (!reorder || disabledReason || target < 0 || target >= shown.length) return;
    setDeleted(false);
    const next = [...shown];
    [next[index], next[target]] = [next[target]!, next[index]!];
    startTransition(() => {
      setShown(next);
      runReorder(next.map((row) => row.id));
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
        {shown.map((row, index) => (
          <li
            key={row.id}
            className="relative flex flex-col gap-3 p-3 transition-colors duration-150 hover:bg-page/60 sm:flex-row sm:items-center sm:px-5 sm:py-4 motion-reduce:transition-none"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {row.imageUrl && (
                <div
                  className={`relative flex-none overflow-hidden rounded-md bg-page ${portraitImages ? 'aspect-[210/297] w-14' : 'aspect-4/3 w-20'}`}
                >
                  <SiteImage src={row.imageUrl} alt="" fill sizes={portraitImages ? '56px' : '80px'} />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold wrap-break-word">
                  <Link
                    prefetch={false}
                    href={row.edit}
                    className="after:absolute after:inset-0 after:content-[''] hover:text-accent-text"
                  >
                    {row.title}
                  </Link>
                </p>
                {row.subtitle && <p className="text-sm wrap-break-word text-muted">{row.subtitle}</p>}
              </div>
            </div>
            <div className="relative z-10 flex flex-wrap items-center gap-1 sm:flex-nowrap">
              {reorder && (
                <>
                  <button
                    type="button"
                    aria-label={`${texts.moveUp}: ${row.title}`}
                    aria-disabled={index === 0 || Boolean(disabledReason)}
                    onClick={() => move(index, -1)}
                    className={iconButton}
                  >
                    <Arrow up />
                  </button>
                  <button
                    type="button"
                    aria-label={`${texts.moveDown}: ${row.title}`}
                    aria-disabled={index === shown.length - 1 || Boolean(disabledReason)}
                    onClick={() => move(index, 1)}
                    className={iconButton}
                  >
                    <Arrow up={false} />
                  </button>
                </>
              )}
              <Link
                prefetch={false}
                href={row.edit}
                aria-label={`${texts.edit}: ${row.title}`}
                className="mr-1 inline-flex min-h-touch items-center justify-center gap-2 rounded-md bg-accent-tint px-4 text-[0.9375rem] font-semibold text-accent-text transition-colors duration-200 hover:bg-accent hover:text-on-accent motion-reduce:transition-none"
              >
                <ActionIcon name="edit" className="size-4" />
                {texts.edit}
              </Link>
              <ConfirmDelete
                name={row.title}
                fields={{ id: row.id, locale }}
                action={deleteRow}
                texts={row.deleteBody ? { ...texts.delete, body: row.deleteBody } : texts.delete}
                formTexts={formTexts}
                disabledReason={disabledReason}
                compact
              />
            </div>
          </li>
        ))}
      </ul>
      {disabledReason && <p className="text-sm text-muted">{disabledReason}</p>}
      <FormStatus
        state={deleted ? { status: 'success' } : result}
        texts={formTexts}
        successText={deleted ? formTexts.deleted : texts.reordered}
      />
    </div>
  );
}
