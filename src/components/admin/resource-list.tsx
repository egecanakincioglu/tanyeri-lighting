'use client';

import { useActionState, useOptimistic, useTransition, type ComponentProps } from 'react';
import type { FormState } from '../../server/admin/form.ts';
import { Link } from '../../i18n/navigation.ts';
import { SiteImage } from '../site-image.tsx';
import { ConfirmDelete, type ConfirmDeleteTexts } from './confirm-delete.tsx';
import { FormStatus } from './form-status.tsx';
import type { FormTexts } from './texts.ts';

export type ResourceRow = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  edit: ComponentProps<typeof Link>['href'];
};

export type ResourceListTexts = {
  edit: string;
  moveUp: string;
  moveDown: string;
  empty: string;
  /** Said after the order was saved. */
  reordered: string;
  delete: ConfirmDeleteTexts;
};

type Props = {
  rows: ResourceRow[];
  locale: string;
  texts: ResourceListTexts;
  formTexts: Pick<FormTexts, 'saved' | 'errors'>;
  /** Receives the complete list of ids in the new order. */
  reorder: (ids: string[]) => Promise<FormState>;
  deleteAction: (previous: FormState | null, formData: FormData) => Promise<FormState>;
  /** Set in the demo: the reason the reorder and delete controls are off. */
  disabledReason?: string | undefined;
};

export const iconButton =
  'grid size-touch place-items-center rounded-md border border-hairline bg-surface text-ink hover:border-accent hover:text-accent-text aria-disabled:cursor-not-allowed aria-disabled:text-muted aria-disabled:hover:border-hairline aria-disabled:hover:text-muted';

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

/** Rows with a thumbnail, edit and delete, and buttons that move a row up or down: no dragging needed. */
export function ResourceList({ rows, locale, texts, formTexts, reorder, deleteAction, disabledReason }: Props) {
  const [shown, setShown] = useOptimistic(rows);
  // An action state, so the answer of the server arrives together with the end of the optimistic order.
  const [result, runReorder] = useActionState(async (_previous: FormState | null, ids: string[]) => reorder(ids), null);
  const [, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-hairline bg-surface px-5 py-10 text-center text-muted">{texts.empty}</p>
    );
  }

  function move(index: number, step: -1 | 1) {
    const target = index + step;
    if (disabledReason || target < 0 || target >= shown.length) return;
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
          <li key={row.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {row.imageUrl && (
                <div className="relative aspect-4/3 w-20 flex-none overflow-hidden rounded-md bg-page">
                  <SiteImage src={row.imageUrl} alt="" fill sizes="80px" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold wrap-break-word">{row.title}</p>
                {row.subtitle && <p className="text-sm wrap-break-word text-muted">{row.subtitle}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <Link
                prefetch={false}
                href={row.edit}
                aria-label={`${texts.edit}: ${row.title}`}
                className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
              >
                {texts.edit}
              </Link>
              <ConfirmDelete
                name={row.title}
                fields={{ id: row.id, locale }}
                action={deleteAction}
                texts={texts.delete}
                formTexts={formTexts}
                disabledReason={disabledReason}
              />
            </div>
          </li>
        ))}
      </ul>
      {disabledReason && <p className="text-sm text-muted">{disabledReason}</p>}
      <FormStatus state={result} texts={formTexts} successText={texts.reordered} />
    </div>
  );
}
