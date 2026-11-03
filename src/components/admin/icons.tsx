// The panel icons: 24 px grid, 1.6 stroke, round ends. They carry no meaning of their own, the label next to them does.
const PATHS = {
  dashboard: 'M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z',
  chart: 'M5 19v-8M12 19V5M19 19v-6',
  image: 'M4 6h16v12H4zM4 15l4-4 4 4 3-3 5 5M15.5 9.5h.01',
  star: 'M12 4l2.4 5 5.6.7-4.1 3.8 1.1 5.5-5-2.8-5 2.8 1.1-5.5L4 9.7 9.6 9z',
  tag: 'M4 12V5h7l9 9-7 7zM8 8.5h.01',
  grid: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z',
  gear: 'M12 9a3 3 0 100 6 3 3 0 000-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1',
  info: 'M12 4a8 8 0 100 16 8 8 0 000-16zM12 11v5M12 8h.01',
  users: 'M9 11a3 3 0 100-6 3 3 0 000 6zM3 19c0-3 2.5-5 6-5s6 2 6 5M16 5.5a3 3 0 010 5.5M18 14.3c1.8.6 3 2.2 3 4.7',
  wrench: 'M14.5 6a4 4 0 005 5l-8.5 8.5a2.1 2.1 0 01-3-3L16.5 8A4 4 0 0014.5 6z',
  folder: 'M4 6h6l2 2h8v10H4z',
  doc: 'M7 4h7l4 4v12H7zM14 4v4h4M10 13h5M10 16h5',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
  layers: 'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  book: 'M5 5h6a2 2 0 012 2v12a2 2 0 00-2-2H5zM19 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  scale: 'M12 4v16M7 20h10M5 8h14M5 8l-2 6a3 3 0 006 0zM19 8l-2 6a3 3 0 006 0z',
  search: 'M11 5a6 6 0 100 12 6 6 0 000-12zM16 16l4 4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c0-3.5 3.6-6 8-6s8 2.5 8 6',
  external: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',
  signOut: 'M10 5H5v14h5M15 8l4 4-4 4M19 12H9',
} as const;

export type AdminIconName = keyof typeof PATHS;

export function AdminIcon({ name, className = 'size-5' }: { name: AdminIconName; className?: string }) {
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
