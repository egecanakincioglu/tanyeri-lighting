import type { ReactNode } from 'react';

type Props = {
  title: string;
  description?: string;
  /** The primary action, such as a link to the create page. */
  action?: ReactNode;
};

/** The top of a panel screen: the one h1, a short description and the primary action. */
export function PageHeader({ title, description, action }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold wrap-break-word">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {action && <div className="flex-none">{action}</div>}
    </div>
  );
}
