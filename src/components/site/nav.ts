// Message keys under `Header` and page addresses as keys of the routing table;
// the header, side menu and footer use this one list.
import type { StaticPath } from '../../i18n/routing.ts';

export type NavEntry = {
  id: string;
  path?: StaticPath;
  children?: readonly { id: string; path: StaticPath }[];
};

export const NAV: readonly NavEntry[] = [
  { id: 'home', path: '/' },
  {
    id: 'corporate',
    children: [
      { id: 'about', path: '/about' },
      { id: 'vision', path: '/vision' },
      { id: 'references', path: '/references' },
    ],
  },
  { id: 'services', path: '/services' },
  { id: 'projects', path: '/projects' },
  {
    id: 'products',
    children: [
      { id: 'catalogs', path: '/catalogs' },
      { id: 'categories', path: '/products' },
    ],
  },
  { id: 'blog', path: '/blog' },
];

// The footer repeats the main sections; a section with a drop-down links to its main page.
export const FOOTER_NAV: readonly { id: string; path: StaticPath }[] = [
  { id: 'corporate', path: '/about' },
  { id: 'services', path: '/services' },
  { id: 'projects', path: '/projects' },
  { id: 'products', path: '/products' },
  { id: 'catalogs', path: '/catalogs' },
  { id: 'blog', path: '/blog' },
];

export const CONTACT_PATH: StaticPath = '/contact';
export const LEGAL_PATHS = { privacy: '/privacy', terms: '/terms' } as const satisfies Record<string, StaticPath>;
