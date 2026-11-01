import Link from 'next/link';

type PaginationItem = {
  label: string;
  href: string;
  current?: boolean;
};

type PaginationProps = {
  /** Accessible name of the navigation landmark. */
  label: string;
  items: PaginationItem[];
};

export function Pagination({ label, items }: PaginationProps) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={`inline-flex min-h-touch min-w-touch items-center justify-center rounded-md border px-3 transition-colors duration-300 ${
                item.current
                  ? 'border-accent bg-accent font-semibold text-on-accent'
                  : 'border-hairline bg-surface font-medium text-ink hover:bg-page'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
