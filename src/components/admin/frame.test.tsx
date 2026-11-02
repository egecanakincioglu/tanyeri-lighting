import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../../test/axe.ts';
import { getTranslations } from '../../test/translations.ts';
import { AdminFrame } from './frame.tsx';
import { buildNavGroups } from './nav.ts';

const navigation = vi.hoisted(() => ({ pathname: '/en/admin' }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => navigation.pathname,
}));

const signOut = vi.fn(async () => {});

async function renderFrame(locale: 'tr' | 'en' = 'en', options: { demo?: boolean; unread?: number } = {}) {
  const t = await getTranslations({ locale, namespace: 'AdminNav' });
  return render(
    <NextIntlClientProvider locale={locale} messages={{}}>
      <AdminFrame
        locale={locale}
        logo={<span>Logo</span>}
        groups={buildNavGroups(t, options.unread ?? 0)}
        email="admin@example.com"
        {...(options.demo ? { demoNotice: t('demoNotice') } : {})}
        signOut={{ action: signOut, label: t('signOut') }}
        labels={{ menu: t('menu'), openMenu: t('openMenu'), closeMenu: t('closeMenu'), viewSite: t('viewSite') }}
      >
        <h1>Screen</h1>
      </AdminFrame>
    </NextIntlClientProvider>,
  );
}

const menu = () => within(screen.getAllByRole('navigation', { hidden: true })[0]!);

describe('AdminFrame', () => {
  beforeEach(() => {
    navigation.pathname = '/en/admin';
    signOut.mockClear();
  });
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('style');
  });

  it('lists every group of the site structure with localized addresses', async () => {
    await renderFrame('en');
    const nav = menu();
    expect(nav.getByText('Home Page')).toBeTruthy();
    expect(nav.getByText('Inbox')).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Dashboard', hidden: true }).getAttribute('href')).toBe('/en/admin');
    expect(nav.getByRole('link', { name: 'Statistics', hidden: true }).getAttribute('href')).toBe(
      '/en/admin/statistics',
    );
    expect(nav.getByRole('link', { name: 'References', hidden: true }).getAttribute('href')).toBe(
      '/en/admin/references',
    );
    expect(nav.getAllByRole('link', { hidden: true })).toHaveLength(18);
  });

  it('uses the Turkish labels and addresses', async () => {
    navigation.pathname = '/tr/yonetim';
    await renderFrame('tr');
    const nav = menu();
    expect(nav.getByText('Gelen Kutusu')).toBeTruthy();
    expect(nav.getByRole('link', { name: 'Öne Çıkan Ürünler', hidden: true }).getAttribute('href')).toBe(
      '/tr/yonetim/one-cikan-urunler',
    );
    expect(nav.getByRole('link', { name: 'Sayfa Bilgileri (SEO)', hidden: true }).getAttribute('href')).toBe(
      '/tr/yonetim/sayfa-bilgileri',
    );
  });

  it('marks only the dashboard as current on its own address', async () => {
    await renderFrame('en');
    const current = menu().getAllByRole('link', { current: 'page', hidden: true });
    expect(current.map((link) => link.textContent)).toEqual(['Dashboard']);
  });

  it('keeps a list current on its edit page and names the screen in the top bar', async () => {
    navigation.pathname = '/en/admin/references/abc';
    const { container } = await renderFrame('en');
    const current = menu().getAllByRole('link', { current: 'page', hidden: true });
    expect(current.map((link) => link.textContent)).toEqual(['References']);
    expect(container.querySelector('header p')?.textContent).toBe('References');
  });

  // jsdom has no layout, so this pins the rule that keeps the title and the content on one left edge: the top bar
  // adds the side padding to its width cap, the content box inside main does not.
  it('caps the top bar one gutter wider than the content', async () => {
    const { container } = await renderFrame('en');
    expect(container.querySelector('header > div')?.className).toContain('max-w-[calc(64rem+2*var(--gutter))]');
    expect(container.querySelector('main > div')?.className).toContain('max-w-5xl');
  });

  it('shows the signed-in address, the link to the site and the screen', async () => {
    await renderFrame('en');
    expect(screen.getByText('admin@example.com')).toBeTruthy();
    const site = screen.getByRole('link', { name: 'View the site' });
    expect(site.getAttribute('href')).toBe('/en');
    expect(site.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('main').textContent).toBe('Screen');
  });

  it('shows the unread count as a badge, and none when everything was read', async () => {
    await renderFrame('en', { unread: 3 });
    expect(screen.getByLabelText('3 unread messages', { selector: 'span' }).textContent).toBe('3');
    cleanup();
    await renderFrame('en', { unread: 0 });
    expect(screen.queryByLabelText(/unread/)).toBeNull();
  });

  it('shows the demo notice only in demo mode', async () => {
    await renderFrame('en', { demo: true });
    expect(screen.getByText(/This is a demo/)).toBeTruthy();
    cleanup();
    await renderFrame('en');
    expect(screen.queryByText(/This is a demo/)).toBeNull();
  });

  it('ends with a sign-out form that carries the language', async () => {
    await renderFrame('tr');
    const button = menu().getByRole('button', { name: 'Çıkış', hidden: true });
    const form = button.closest('form')!;
    expect((form.querySelector('input[name="locale"]') as HTMLInputElement).value).toBe('tr');
    expect(button.getAttribute('type')).toBe('submit');
  });

  describe('the slide-in menu', () => {
    it('opens as a dialog, makes the page inert and moves focus into it', async () => {
      await renderFrame('en');
      const open = screen.getByRole('button', { name: 'Open the menu' });
      expect(open.getAttribute('aria-expanded')).toBe('false');
      fireEvent.click(open);
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(open.getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close the menu' }));
      expect(screen.getByRole('main').closest('[inert]')).not.toBeNull();
      expect(document.documentElement.style.overflow).toBe('hidden');
    });

    it('closes with Escape and gives focus back to the button', async () => {
      await renderFrame('en');
      const open = screen.getByRole('button', { name: 'Open the menu' });
      fireEvent.click(open);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByRole('main').closest('[inert]')).toBeNull();
      expect(document.documentElement.style.overflow).toBe('');
      expect(document.activeElement).toBe(open);
    });

    it('closes from the close button, the backdrop and a link', async () => {
      await renderFrame('en');
      const open = screen.getByRole('button', { name: 'Open the menu' });
      fireEvent.click(open);
      fireEvent.click(screen.getByRole('button', { name: 'Close the menu' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(open);
      fireEvent.click(document.querySelector('[aria-hidden="true"].fixed')!);
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(open);
      fireEvent.click(screen.getByRole('link', { name: 'Services' }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('keeps Tab inside the menu, wrapping from the last control to the first and back', async () => {
      await renderFrame('en');
      fireEvent.click(screen.getByRole('button', { name: 'Open the menu' }));
      const dialog = screen.getByRole('dialog');
      const controls = [...dialog.querySelectorAll<HTMLElement>('a[href], button')];
      controls.at(-1)!.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(controls[0]);
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(controls.at(-1));
    });

    it('closes when the screen becomes wide', async () => {
      let listener: ((event: MediaQueryListEvent) => void) | undefined;
      const original = window.matchMedia;
      window.matchMedia = ((query: string) => ({
        matches: false,
        media: query,
        addEventListener: (_: string, callback: (event: MediaQueryListEvent) => void) => (listener = callback),
        removeEventListener: () => {},
      })) as unknown as typeof window.matchMedia;
      try {
        await renderFrame('en');
        fireEvent.click(screen.getByRole('button', { name: 'Open the menu' }));
        act(() => listener?.({ matches: true } as MediaQueryListEvent));
        expect(screen.queryByRole('dialog')).toBeNull();
      } finally {
        window.matchMedia = original;
      }
    });
  });

  it('has no axe violations, closed or open', async () => {
    const { container } = await renderFrame('en', { unread: 2, demo: true });
    expect(await axeViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Open the menu' }));
    expect(await axeViolations(container)).toEqual([]);
  });
});
