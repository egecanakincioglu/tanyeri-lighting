// The public menu: message keys under `Header` and page addresses as keys of the routing table. The header, the side menu and the
// footer are built from this one list. Pages that do not exist yet answer with the not-found page.
import type { StaticPath } from '../../i18n/routing.ts';

export type NavEntry = {
  key: string;
  path?: StaticPath;
  children?: readonly { key: string; path: StaticPath }[];
};

export const NAV: readonly NavEntry[] = [
  { key: 'home', path: '/' },
  {
    key: 'corporate',
    children: [
      { key: 'about', path: '/about' },
      { key: 'vision', path: '/vision' },
      { key: 'references', path: '/references' },
    ],
  },
  { key: 'services', path: '/services' },
  { key: 'projects', path: '/projects' },
  {
    key: 'products',
    children: [
      { key: 'catalogs', path: '/catalogs' },
      { key: 'categories', path: '/products' },
    ],
  },
];

// The footer repeats the main sections; a section with a drop-down links to its main page.
export const FOOTER_NAV: readonly { key: string; path: StaticPath }[] = [
  { key: 'corporate', path: '/about' },
  { key: 'services', path: '/services' },
  { key: 'projects', path: '/projects' },
  { key: 'products', path: '/products' },
  { key: 'catalogs', path: '/catalogs' },
];

export const CONTACT_PATH: StaticPath = '/contact';
export const LEGAL_PATHS = { privacy: '/privacy', terms: '/terms' } as const satisfies Record<string, StaticPath>;
