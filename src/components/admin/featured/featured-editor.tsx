'use client';

import { startTransition, useActionState, useId, useState } from 'react';
import type { FormState } from '../../../server/admin/form.ts';
import { Button } from '../../button.tsx';
import { SiteImage } from '../../site-image.tsx';
import { FormStatus } from '../form-status.tsx';
import { Arrow, iconButton } from '../resource-list.tsx';
import type { FormTexts } from '../texts.ts';

export type FeaturedItem = { id: string; name: string; code: string; imageUrl: string };

type FeaturedTexts = {
  current: string;
  /** Holds `{count}` and `{max}`. */
  counter: string;
  empty: string;
  moveUp: string;
  moveDown: string;
  remove: string;
  add: string;
  search: string;
  noMatch: string;
  /** Said when the list is full. */
  full: string;
  /** Said when more products match than are listed. */
  refine: string;
};

type Props = {
  initial: FeaturedItem[];
  products: FeaturedItem[];
  limit: number;
  save: (ids: string[]) => Promise<FormState>;
  texts: FeaturedTexts;
  formTexts: FormTexts;
  /** Set in the demo: the reason every control is off. */
  disabledReason?: string | undefined;
};

const LISTED = 30;

function Thumb({ item }: { item: FeaturedItem }) {
  return (
    <div className="relative aspect-square w-14 flex-none overflow-hidden rounded-md bg-page">
      <SiteImage src={item.imageUrl} alt="" fill sizes="56px" />
    </div>
  );
}

/** The home page's product list: the chosen products in order, and a searchable list of the others to add. */
export function FeaturedEditor({ initial, products, limit, save, texts, formTexts, disabledReason }: Props) {
  const [chosen, setChosen] = useState(initial);
  const [query, setQuery] = useState('');
  const [state, run, pending] = useActionState(async (_previous: FormState | null, ids: string[]) => save(ids), null);
  const searchId = useId();
  const off = Boolean(disabledReason);
  const full = chosen.length >= limit;

  const needle = query.trim().toLocaleLowerCase();
  const taken = new Set(chosen.map((item) => item.id));
  const matches = products.filter(
    (item) =>
      !taken.has(item.id) && (needle === '' || `${item.name} ${item.code}`.toLocaleLowerCase().includes(needle)),
  );

  function move(index: number, step: -1 | 1) {
    const target = index + step;
    if (off || target < 0 || target >= chosen.length) return;
    const next = [...chosen];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setChosen(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${searchId}-current`} className="flex flex-col gap-3">
        <h2 id={`${searchId}-current`} className="text-base font-bold">
          {texts.current}{' '}
          <span className="font-normal text-muted">
            {texts.counter.replace('{count}', String(chosen.length)).replace('{max}', String(limit))}
          </span>
        </h2>
        {chosen.length === 0 ? (
          <p className="rounded-lg border border-hairline bg-surface px-5 py-8 text-center text-muted">{texts.empty}</p>
        ) : (
          <ol className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
            {chosen.map((item, index) => (
              <li key={item.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Thumb item={item} />
                  <div className="min-w-0">
                    <p className="font-semibold wrap-break-word">{item.name}</p>
                    <p className="text-sm text-muted">{item.code}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    aria-label={`${texts.moveUp}: ${item.name}`}
                    aria-disabled={index === 0 || off}
                    onClick={() => move(index, -1)}
                    className={iconButton}
                  >
                    <Arrow up />
                  </button>
                  <button
                    type="button"
                    aria-label={`${texts.moveDown}: ${item.name}`}
                    aria-disabled={index === chosen.length - 1 || off}
                    onClick={() => move(index, 1)}
                    className={iconButton}
                  >
                    <Arrow up={false} />
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`${texts.remove}: ${item.name}`}
                    disabled={off}
                    onClick={() => setChosen(chosen.filter((other) => other.id !== item.id))}
                  >
                    {texts.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby={`${searchId}-add`} className="flex flex-col gap-3">
        <h2 id={`${searchId}-add`} className="text-base font-bold">
          {texts.add}
        </h2>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={searchId} className="text-sm font-semibold">
            {texts.search}
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={off || full}
            className="block min-h-touch w-full rounded-md border border-hairline bg-surface px-4 py-3 text-base text-ink"
          />
        </div>
        {full ? (
          <p className="text-sm text-muted">{texts.full}</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted">{texts.noMatch}</p>
        ) : (
          <>
            <ul className="max-h-96 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline bg-surface">
              {matches.slice(0, LISTED).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={off}
                    aria-label={`${texts.add}: ${item.name}`}
                    onClick={() => setChosen([...chosen, item])}
                    className="flex min-h-touch w-full items-center gap-3 p-3 text-left hover:bg-page disabled:cursor-not-allowed disabled:text-muted"
                  >
                    <Thumb item={item} />
                    <span className="min-w-0">
                      <span className="block font-semibold wrap-break-word">{item.name}</span>
                      <span className="block text-sm text-muted">{item.code}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {matches.length > LISTED && <p className="text-sm text-muted">{texts.refine}</p>}
          </>
        )}
      </section>

      <FormStatus state={state} texts={formTexts} />
      {disabledReason && <p className="text-sm text-muted">{disabledReason}</p>}
      <div>
        <Button
          type="button"
          disabled={off || pending}
          onClick={() => startTransition(() => run(chosen.map((item) => item.id)))}
        >
          {pending ? formTexts.saving : formTexts.save}
        </Button>
      </div>
    </div>
  );
}
