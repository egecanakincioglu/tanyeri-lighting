import type { StaticPath } from '../../i18n/routing.ts';
import type { FrameGroup } from './frame.tsx';

// The panel menu, grouped like the site: the keys are the labels in messages (AdminNav.groups and AdminNav.items) and
// the addresses are keys of routing.pathnames. A screen without a page file is answered by the shared placeholder.
export const ADMIN_NAV = [
  { id: 'general', items: [{ id: 'panel', href: '/dashboard' }] },
  {
    id: 'home',
    items: [
      { id: 'banner', href: '/dashboard/banner' },
      { id: 'featured', href: '/dashboard/featured-products' },
      { id: 'promo', href: '/dashboard/promo-boards' },
      { id: 'areas', href: '/dashboard/application-areas' },
    ],
  },
  {
    id: 'corporate',
    items: [
      { id: 'settings', href: '/dashboard/settings' },
      { id: 'about', href: '/dashboard/about' },
      { id: 'references', href: '/dashboard/references' },
    ],
  },
  {
    id: 'content',
    items: [
      { id: 'services', href: '/dashboard/services' },
      { id: 'projects', href: '/dashboard/projects' },
    ],
  },
  {
    id: 'products',
    items: [
      { id: 'products', href: '/dashboard/products' },
      { id: 'categories', href: '/dashboard/categories' },
      { id: 'catalogs', href: '/dashboard/catalogs' },
    ],
  },
  { id: 'inbox', items: [{ id: 'messages', href: '/dashboard/messages' }] },
  {
    id: 'site',
    items: [
      { id: 'legal', href: '/dashboard/legal-pages' },
      { id: 'seo', href: '/dashboard/seo' },
    ],
  },
  { id: 'account', items: [{ id: 'account', href: '/dashboard/account' }] },
] as const satisfies readonly { id: string; items: readonly { id: string; href: StaticPath }[] }[];

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The menu with its labels; `unread` is the badge of the messages item. */
export function buildNavGroups(t: Translate, unread: number): FrameGroup[] {
  return ADMIN_NAV.map((group) => ({
    label: t(`groups.${group.id}`),
    items: group.items.map((item) => ({
      href: item.href,
      label: t(`items.${item.id}`),
      ...(item.id === 'messages' ? { badge: { count: unread, label: t('unread', { count: unread }) } } : {}),
    })),
  }));
}

/** The label key of a screen, or undefined when the address is not one of the panel's screens. */
export function itemKeyOfSection(section: string): string | undefined {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.href === `/dashboard/${section}`) return item.id;
    }
  }
  return undefined;
}
