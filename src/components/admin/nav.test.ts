import { describe, expect, it } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import { routing } from '../../i18n/routing.ts';
import { ADMIN_NAV, buildNavGroups, itemKeyOfSection } from './nav.ts';

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

describe('ADMIN_NAV', () => {
  it('points every item at an address of the routing table, localized in both languages', () => {
    for (const group of ADMIN_NAV) {
      for (const item of group.items) {
        const entry = routing.pathnames[item.href];
        if (item.href === '/dashboard') continue;
        expect(entry, item.href).toMatchObject({
          tr: expect.stringMatching(/^\/yonetim\//),
          en: expect.stringMatching(/^\/admin\//),
        });
      }
    }
  });

  it('has a label in both languages for every group and item', () => {
    for (const messages of [tr, en]) {
      for (const group of ADMIN_NAV) {
        expect(messages.AdminNav.groups[group.id], group.id).toBeTruthy();
        for (const item of group.items) expect(messages.AdminNav.items[item.id], item.id).toBeTruthy();
      }
    }
  });

  it('uses each address once', () => {
    const hrefs = ADMIN_NAV.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe('buildNavGroups', () => {
  it('labels the groups and items and gives only the messages item a badge', () => {
    const groups = buildNavGroups(t, 4);
    expect(groups[0]).toEqual({ label: 'groups.general', items: [{ href: '/dashboard', label: 'items.panel' }] });
    const messages = groups.flatMap((group) => group.items).filter((item) => item.badge);
    expect(messages).toEqual([
      { href: '/dashboard/messages', label: 'items.messages', badge: { count: 4, label: 'unread:{"count":4}' } },
    ]);
  });
});

describe('itemKeyOfSection', () => {
  it('finds the item of a panel address segment and nothing else', () => {
    expect(itemKeyOfSection('featured-products')).toBe('featured');
    expect(itemKeyOfSection('references')).toBe('references');
    expect(itemKeyOfSection('nope')).toBeUndefined();
    expect(itemKeyOfSection('')).toBeUndefined();
  });
});
