import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../messages/en.json' with { type: 'json' };
import tr from '../../../messages/tr.json' with { type: 'json' };
import { Header } from './header.tsx';

const navigation = vi.hoisted(() => ({ pathname: '/tr', params: {} as Record<string, string | string[]> }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => navigation.pathname,
  useParams: () => ({ locale: 'tr', ...navigation.params }),
}));

function renderHeader(locale: 'tr' | 'en' = 'tr') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'tr' ? tr : en}>
      <Header />
      <main data-page-region>
        <a href="#x">Page link</a>
      </main>
    </NextIntlClientProvider>,
  );
}

// The side menu repeats every label, so the bar's queries stay inside its navigation landmark.
const desktopNav = () => within(screen.getByRole('navigation'));

async function violations(container: HTMLElement) {
  const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return result.violations.map((violation) => violation.id);
}

describe('Header', () => {
  beforeEach(() => {
    navigation.pathname = '/tr';
    navigation.params = {};
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.documentElement.removeAttribute('style');
  });

  it('shows the menu, the contact link and the language links in Turkish', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Menü' });
    expect(within(nav).getByRole('link', { name: 'Anasayfa' }).getAttribute('href')).toBe('/tr');
    expect(within(nav).getByRole('link', { name: 'Hizmetler' }).getAttribute('href')).toBe('/tr/hizmetler');
    expect(within(nav).getByRole('button', { name: 'Kurumsal' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Kategoriler' }).getAttribute('href')).toBe('/tr/urunler');
    expect(screen.getAllByRole('link', { name: 'İletişim' })[0]?.getAttribute('href')).toBe('/tr/iletisim');
    expect(screen.getAllByRole('link', { name: 'Tanyeri Lighting, ana sayfa' })).toHaveLength(2);
  });

  it('shows English labels and prefixes', () => {
    renderHeader('en');
    const nav = screen.getByRole('navigation', { name: 'Menu' });
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/en');
    expect(within(nav).getByRole('link', { name: 'Catalogs' }).getAttribute('href')).toBe('/en/catalogs');
  });

  it('marks the current page and its menu', () => {
    navigation.pathname = '/tr/urunler';
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'Menü' });
    expect(within(nav).getByRole('link', { name: 'Kategoriler' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Kataloglar' }).getAttribute('aria-current')).toBeNull();
    expect(within(nav).getByRole('button', { name: 'Ürünler' }).hasAttribute('data-current')).toBe(true);
    expect(within(nav).getByRole('link', { name: 'Anasayfa' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks the home page only on the exact path', () => {
    renderHeader();
    expect(screen.getAllByRole('link', { name: 'Anasayfa' })[0]?.getAttribute('aria-current')).toBe('page');
  });

  it('links to the same page in the other language', () => {
    navigation.pathname = '/tr/urunler';
    renderHeader();
    const group = screen.getByRole('group', { name: 'Dil' });
    expect(within(group).getByRole('link', { name: 'EN, English' }).getAttribute('href')).toBe('/en/products');
    expect(within(group).getByRole('link', { name: 'TR, Türkçe' }).getAttribute('aria-current')).toBe('true');
    expect(within(group).getByRole('link', { name: 'EN, English' }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps the route parameters in the language links of a dynamic page', () => {
    navigation.pathname = '/tr/urunler/cerceveli-gomme-spot-7w';
    navigation.params = { slug: 'cerceveli-gomme-spot-7w' };
    renderHeader();
    const group = screen.getByRole('group', { name: 'Dil' });
    expect(within(group).getByRole('link', { name: 'EN, English' }).getAttribute('href')).toBe(
      '/en/products/cerceveli-gomme-spot-7w',
    );
    expect(within(group).getByRole('link', { name: 'TR, Türkçe' }).getAttribute('href')).toBe(
      '/tr/urunler/cerceveli-gomme-spot-7w',
    );
    expect(desktopNav().getByRole('link', { name: 'Kategoriler' }).getAttribute('aria-current')).toBe('page');
    expect(desktopNav().getByRole('button', { name: 'Ürünler' }).hasAttribute('data-current')).toBe(true);
  });

  it('renders the language links on an unknown address', () => {
    navigation.pathname = '/tr/yok/bir-sayfa';
    navigation.params = { rest: ['yok', 'bir-sayfa'] };
    expect(() => renderHeader()).not.toThrow();
    const group = screen.getByRole('group', { name: 'Dil' });
    expect(within(group).getAllByRole('link')).toHaveLength(2);
  });

  it('adds the shadow after 4 px of scroll and removes it again', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    expect(header.className).not.toContain('shadow-[');
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 10, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header.className).toContain('shadow-[');
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(header.className).not.toContain('shadow-[');
  });

  describe('drop-down menus', () => {
    it('opens with the arrow keys and moves focus through the links', () => {
      renderHeader();
      const trigger = desktopNav().getByRole('button', { name: 'Kurumsal' });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');

      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      const about = desktopNav().getByRole('link', { name: 'Hakkımızda' });
      expect(document.activeElement).toBe(about);

      fireEvent.keyDown(about, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(desktopNav().getByRole('link', { name: 'Vizyonumuz' }));
      fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
      expect(document.activeElement).toBe(desktopNav().getByRole('link', { name: 'Referanslarımız' }));
      fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(about);
      fireEvent.keyDown(about, { key: 'Home' });
      expect(document.activeElement).toBe(about);
      fireEvent.keyDown(about, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(trigger);
    });

    it('opens on ArrowUp at the last link and closes on Escape with focus back on the button', () => {
      renderHeader();
      const trigger = desktopNav().getByRole('button', { name: 'Ürünler' });
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'ArrowUp' });
      const last = desktopNav().getByRole('link', { name: 'Kategoriler' });
      expect(document.activeElement).toBe(last);
      fireEvent.keyDown(last, { key: 'Escape' });
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(trigger);
    });

    it('toggles on click and keeps only one menu open', () => {
      renderHeader();
      const corporate = desktopNav().getByRole('button', { name: 'Kurumsal' });
      const products = desktopNav().getByRole('button', { name: 'Ürünler' });
      fireEvent.click(corporate);
      expect(corporate.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(products);
      expect(corporate.getAttribute('aria-expanded')).toBe('false');
      expect(products.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(products);
      expect(products.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes when focus leaves, when the page scrolls and on a press elsewhere', () => {
      renderHeader();
      const corporate = desktopNav().getByRole('button', { name: 'Kurumsal' });
      fireEvent.click(corporate);
      fireEvent.blur(corporate, { relatedTarget: desktopNav().getByRole('link', { name: 'Hizmetler' }) });
      expect(corporate.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(corporate);
      act(() => {
        window.dispatchEvent(new Event('scroll'));
      });
      expect(corporate.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(corporate);
      fireEvent.pointerDown(document.body);
      expect(corporate.getAttribute('aria-expanded')).toBe('false');
    });

    it('opens on hover after the intent delay and closes after the leave delay', () => {
      vi.useFakeTimers();
      renderHeader();
      const corporate = desktopNav().getByRole('button', { name: 'Kurumsal' });
      const item = corporate.closest('li') as HTMLElement;

      fireEvent.pointerEnter(item, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(89);
      });
      expect(corporate.getAttribute('aria-expanded')).toBe('false');
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(corporate.getAttribute('aria-expanded')).toBe('true');

      fireEvent.pointerLeave(item, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(219);
      });
      expect(corporate.getAttribute('aria-expanded')).toBe('true');
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(corporate.getAttribute('aria-expanded')).toBe('false');
    });

    it('keeps a menu open that was opened by hover and then clicked', () => {
      vi.useFakeTimers();
      renderHeader();
      const corporate = desktopNav().getByRole('button', { name: 'Kurumsal' });
      const item = corporate.closest('li') as HTMLElement;
      fireEvent.pointerEnter(item, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(90);
      });
      fireEvent.click(corporate);
      expect(corporate.getAttribute('aria-expanded')).toBe('true');
      fireEvent.pointerLeave(item, { pointerType: 'mouse' });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(corporate.getAttribute('aria-expanded')).toBe('true');
      fireEvent.click(corporate);
      expect(corporate.getAttribute('aria-expanded')).toBe('false');
    });

    it('ignores touch pointers for hover', () => {
      vi.useFakeTimers();
      renderHeader();
      const corporate = desktopNav().getByRole('button', { name: 'Kurumsal' });
      fireEvent.pointerEnter(corporate.closest('li') as HTMLElement, { pointerType: 'touch' });
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(corporate.getAttribute('aria-expanded')).toBe('false');
    });

    it('switches at once when another menu is already open', () => {
      vi.useFakeTimers();
      renderHeader();
      const corporate = desktopNav().getByRole('button', { name: 'Kurumsal' });
      const products = desktopNav().getByRole('button', { name: 'Ürünler' });
      fireEvent.click(corporate);
      fireEvent.pointerEnter(products.closest('li') as HTMLElement, { pointerType: 'mouse' });
      expect(products.getAttribute('aria-expanded')).toBe('true');
      expect(corporate.getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('side menu', () => {
    it('opens, takes focus, locks the page and makes the rest inert', () => {
      renderHeader();
      const open = screen.getByRole('button', { name: 'Menüyü aç' });
      const dialog = document.getElementById('side-menu') as HTMLElement;
      expect(dialog.hasAttribute('inert')).toBe(true);
      expect(dialog.hasAttribute('aria-modal')).toBe(false);

      fireEvent.click(open);
      expect(open.getAttribute('aria-expanded')).toBe('true');
      expect(dialog.hasAttribute('inert')).toBe(false);
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Menüyü kapat' }));
      expect(document.documentElement.style.overflow).toBe('hidden');
      expect(screen.getByRole('main').hasAttribute('inert')).toBe(true);
    });

    it('shows the logo at the top of the side menu', () => {
      renderHeader();
      const dialog = document.getElementById('side-menu') as HTMLElement;
      expect(within(dialog).getByRole('link', { name: 'Tanyeri Lighting, ana sayfa' }).getAttribute('href')).toBe(
        '/tr',
      );
      expect(dialog.getAttribute('aria-label')).toBe('Menü');
    });

    it('closes with Escape and returns focus to the menu button', () => {
      renderHeader();
      const open = screen.getByRole('button', { name: 'Menüyü aç' });
      fireEvent.click(open);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(open.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(open);
      expect(document.documentElement.style.overflow).toBe('');
      expect(screen.getByRole('main').hasAttribute('inert')).toBe(false);
      expect((document.getElementById('side-menu') as HTMLElement).hasAttribute('inert')).toBe(true);
    });

    it('closes from the close button, the backdrop and a link', () => {
      renderHeader();
      const open = screen.getByRole('button', { name: 'Menüyü aç' });
      const dialog = document.getElementById('side-menu') as HTMLElement;

      fireEvent.click(open);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Menüyü kapat' }));
      expect(open.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(open);
      fireEvent.click(dialog.previousElementSibling as Element);
      expect(open.getAttribute('aria-expanded')).toBe('false');

      fireEvent.click(open);
      fireEvent.click(within(dialog).getByRole('link', { name: 'Hizmetler' }));
      expect(open.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(open);
    });

    it('keeps Tab inside the dialog', () => {
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Menüyü aç' }));
      const dialog = document.getElementById('side-menu') as HTMLElement;
      const first = within(dialog).getByRole('link', { name: 'Tanyeri Lighting, ana sayfa' });
      const contact = within(dialog).getAllByRole('link', { name: 'İletişim' })[0] as HTMLElement;

      first.focus();
      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(contact);
      fireEvent.keyDown(contact, { key: 'Tab' });
      expect(document.activeElement).toBe(first);
    });

    it('opens a sub-menu, which is inert while it is collapsed', () => {
      renderHeader();
      fireEvent.click(screen.getByRole('button', { name: 'Menüyü aç' }));
      const dialog = document.getElementById('side-menu') as HTMLElement;
      const group = within(dialog).getByRole('button', { name: 'Ürünler' });
      const list = document.getElementById(group.getAttribute('aria-controls') as string) as HTMLElement;
      expect(group.getAttribute('aria-expanded')).toBe('false');
      expect(list.hasAttribute('inert')).toBe(true);
      fireEvent.click(group);
      expect(group.getAttribute('aria-expanded')).toBe('true');
      expect(list.hasAttribute('inert')).toBe(false);
      fireEvent.click(group);
      expect(list.hasAttribute('inert')).toBe(true);
    });

    it('closes when the screen becomes wide enough for the menu bar', () => {
      let listener: ((event: { matches: boolean }) => void) | undefined;
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({
          matches: false,
          addEventListener: (_: string, fn: typeof listener) => {
            listener = fn;
          },
          removeEventListener: () => {},
        })),
      );
      renderHeader();
      const open = screen.getByRole('button', { name: 'Menüyü aç' });
      fireEvent.click(open);
      act(() => {
        listener?.({ matches: true });
      });
      expect(open.getAttribute('aria-expanded')).toBe('false');
      vi.unstubAllGlobals();
    });
  });

  describe('accessibility', () => {
    it('has no axe violations when closed', async () => {
      const { container } = renderHeader();
      expect(await violations(container)).toEqual([]);
    });

    it('has no axe violations with a drop-down open', async () => {
      const { container } = renderHeader();
      fireEvent.click(desktopNav().getByRole('button', { name: 'Kurumsal' }));
      expect(await violations(container)).toEqual([]);
    });

    it('has no axe violations with the side menu open', async () => {
      const { container } = renderHeader('en');
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      fireEvent.click(
        within(document.getElementById('side-menu') as HTMLElement).getByRole('button', { name: 'Corporate' }),
      );
      expect(await violations(container)).toEqual([]);
    });
  });
});
