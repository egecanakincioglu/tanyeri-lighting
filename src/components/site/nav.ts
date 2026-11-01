// The public menu: message keys under `Header` and page addresses as keys of the routing table. The header, the side menu and the
// footer are built from this one list. Pages that do not exist yet answer with the not-found page.
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
];

// The footer repeats the main sections; a section with a drop-down links to its main page.
export const FOOTER_NAV: readonly { id: string; path: StaticPath }[] = [
  { id: 'corporate', path: '/about' },
  { id: 'services', path: '/services' },
  { id: 'projects', path: '/projects' },
  { id: 'products', path: '/products' },
  { id: 'catalogs', path: '/catalogs' },
];

export const CONTACT_PATH: StaticPath = '/contact';
export const LEGAL_PATHS = { privacy: '/privacy', terms: '/terms' } as const satisfies Record<string, StaticPath>;
