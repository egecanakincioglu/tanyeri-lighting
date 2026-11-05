import Link from 'next/link';

type Crumb = {
  name: string;
  href?: string;
};

type BreadcrumbProps = {
  label: string;
  items: Crumb[];
};

export function Breadcrumb({ label, items }: BreadcrumbProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex min-w-0 flex-nowrap items-center text-sm text-muted">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li
              key={item.name}
              className={[
                'flex min-w-0 items-center',
                last ? '' : 'flex-none',
                index > 0 ? "before:mx-2 before:text-muted before:content-['›']" : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {last || !item.href ? (
                <span aria-current={last ? 'page' : undefined} className="min-h-touch flex min-w-0 items-center">
                  <span className="truncate font-semibold text-ink">{item.name}</span>
                </span>
              ) : (
                <Link
                  href={item.href}
                  prefetch={false}
                  className="inline-flex min-h-touch items-center underline-offset-4 hover:text-accent-text hover:underline"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
