import type { StaticPath } from '../../i18n/routing.ts';
import type { FrameGroup } from './frame.tsx';
import type { AdminIconName } from './icons.tsx';

// Keys are labels in messages (AdminNav.groups and AdminNav.items) and keys of routing.pathnames.
export const ADMIN_NAV = [
  {
    id: 'general',
    items: [
      { id: 'panel', href: '/dashboard', icon: 'dashboard' },
      { id: 'stats', href: '/dashboard/statistics', icon: 'chart' },
    ],
  },
  {
    id: 'home',
    items: [
      { id: 'banner', href: '/dashboard/banner', icon: 'image' },
      { id: 'featured', href: '/dashboard/featured-products', icon: 'star' },
      { id: 'promo', href: '/dashboard/promo-boards', icon: 'tag' },
      { id: 'areas', href: '/dashboard/application-areas', icon: 'grid' },
    ],
  },
  {
    id: 'corporate',
    items: [
      { id: 'settings', href: '/dashboard/settings', icon: 'gear' },
      { id: 'about', href: '/dashboard/about', icon: 'info' },
      { id: 'references', href: '/dashboard/references', icon: 'users' },
    ],
  },
  {
    id: 'content',
    items: [
      { id: 'services', href: '/dashboard/services', icon: 'wrench' },
      { id: 'projects', href: '/dashboard/projects', icon: 'folder' },
      { id: 'blog', href: '/dashboard/blog', icon: 'doc' },
    ],
  },
  {
    id: 'products',
    items: [
      { id: 'products', href: '/dashboard/products', icon: 'box' },
      { id: 'categories', href: '/dashboard/categories', icon: 'layers' },
      { id: 'catalogs', href: '/dashboard/catalogs', icon: 'book' },
    ],
  },
  { id: 'inbox', items: [{ id: 'messages', href: '/dashboard/messages', icon: 'mail' }] },
  {
    id: 'site',
    items: [
      { id: 'legal', href: '/dashboard/legal-pages', icon: 'scale' },
      { id: 'seo', href: '/dashboard/seo', icon: 'search' },
    ],
  },
  { id: 'account', items: [{ id: 'account', href: '/dashboard/account', icon: 'user' }] },
] as const satisfies readonly { id: string; items: readonly { id: string; href: StaticPath; icon: AdminIconName }[] }[];

type Translate = (key: string, values?: Record<string, string | number>) => string;

export function buildNavGroups(t: Translate, unread: number): FrameGroup[] {
  return ADMIN_NAV.map((group) => ({
    label: t(`groups.${group.id}`),
    items: group.items.map((item) => ({
      href: item.href,
      icon: item.icon,
      label: t(`items.${item.id}`),
      ...(item.id === 'messages' ? { badge: { count: unread, label: t('unread', { count: unread }) } } : {}),
    })),
  }));
}

export function itemKeyOfSection(section: string): string | undefined {
  for (const group of ADMIN_NAV) {
    for (const item of group.items) {
      if (item.href === `/dashboard/${section}`) return item.id;
    }
  }
  return undefined;
}
