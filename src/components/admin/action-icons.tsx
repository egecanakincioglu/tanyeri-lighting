const PATHS = {
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5',
  upload: 'M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14',
  plus: 'M12 5v14M5 12h14',
} as const;

export type ActionIconName = keyof typeof PATHS;

export function ActionIcon({ name, className = 'size-5' }: { name: ActionIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
