import { Link } from '../../../i18n/navigation.ts';
import { Button } from '../../button.tsx';
import { TextField } from '../../field.tsx';
import { SelectField } from '../select-field.tsx';

type FilterTexts = {
  searchLabel: string;
  categoryLabel: string;
  allCategories: string;
  search: string;
  clear: string;
};

type FiltersProps = {
  action: string;
  q: string;
  category: string;
  categories: readonly { value: string; label: string }[];
  texts: FilterTexts;
};

/** A plain GET form, so a filtered list can be bookmarked. */
export function ProductFilters({ action, q, category, categories, texts }: FiltersProps) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="mb-4 grid gap-4 rounded-lg border border-hairline bg-surface p-4 md:grid-cols-[1fr_16rem_auto] md:items-end"
    >
      <TextField id="q" name="q" label={texts.searchLabel} defaultValue={q} maxLength={100} type="search" />
      <SelectField
        id="category"
        name="category"
        label={texts.categoryLabel}
        defaultValue={category}
        options={[{ value: '', label: texts.allCategories }, ...categories]}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{texts.search}</Button>
        {(q !== '' || category !== '') && (
          <Link
            prefetch={false}
            href="/dashboard/products"
            className="inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text"
          >
            {texts.clear}
          </Link>
        )}
      </div>
    </form>
  );
}

type PagerProps = {
  page: number;
  pages: number;
  q: string;
  category: string;
  texts: { label: string; status: string; previous: string; next: string };
};

const pagerLink =
  'inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold hover:border-accent hover:text-accent-text';
const pagerOff =
  'inline-flex min-h-touch items-center justify-center rounded-md border border-hairline bg-surface px-5 text-[0.9375rem] font-semibold text-muted';

export function ProductPager({ page, pages, q, category, texts }: PagerProps) {
  if (pages <= 1) return null;
  const query = (target: number) => ({
    ...(q === '' ? {} : { q }),
    ...(category === '' ? {} : { category }),
    ...(target === 1 ? {} : { page: String(target) }),
  });
  return (
    <nav aria-label={texts.label} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? (
        <Link
          prefetch={false}
          href={{ pathname: '/dashboard/products', query: query(page - 1) }}
          rel="prev"
          className={pagerLink}
        >
          {texts.previous}
        </Link>
      ) : (
        <span aria-disabled="true" className={pagerOff}>
          {texts.previous}
        </span>
      )}
      <span className="text-sm text-muted">{texts.status}</span>
      {page < pages ? (
        <Link
          prefetch={false}
          href={{ pathname: '/dashboard/products', query: query(page + 1) }}
          rel="next"
          className={pagerLink}
        >
          {texts.next}
        </Link>
      ) : (
        <span aria-disabled="true" className={pagerOff}>
          {texts.next}
        </span>
      )}
    </nav>
  );
}
