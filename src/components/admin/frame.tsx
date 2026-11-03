'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, usePathname } from '../../i18n/navigation.ts';
import type { StaticPath } from '../../i18n/routing.ts';
import { AdminIcon, type AdminIconName } from './icons.tsx';

type FrameItem = { href: StaticPath; icon: AdminIconName; label: string; badge?: { count: number; label: string } };
export type FrameGroup = { label: string; items: FrameItem[] };

type Props = {
  locale: string;
  logo: ReactNode;
  groups: FrameGroup[];
  email: string;
  /** Set in demo mode: the note about the read-only panel. */
  demoNotice?: string;
  signOut: { action: (formData: FormData) => Promise<void>; label: string };
  labels: { menu: string; openMenu: string; closeMenu: string; viewSite: string };
  children: ReactNode;
};

const DESKTOP_QUERY = '(min-width: 64rem)';

// The panel home is `/dashboard`, the parent of every other screen, so it only matches itself.
function matches(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass =
  'group relative flex min-h-touch w-full items-center gap-3 rounded-md px-3 text-left text-[0.9375rem] font-medium text-ink transition-colors duration-150 hover:bg-page aria-[current=page]:bg-accent-tint aria-[current=page]:font-semibold aria-[current=page]:text-accent-text motion-reduce:transition-none lg:min-h-9';

export function AdminFrame({ locale, logo, groups, email, demoNotice, signOut, labels, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  const items = groups.flatMap((group) => group.items);
  // The deepest matching address names the screen, so an edit page still belongs to its list.
  const current = items.filter((item) => matches(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0];

  const currentGroup = groups.find((group) => group.items.some((item) => item.href === current?.href));

  // A long menu keeps the current item in view when the screen changes.
  useEffect(() => {
    asideRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [current?.href]);

  // The slide-in menu of narrow screens behaves like the site's side menu: the page behind it is inert, Tab stays
  // inside, Escape closes it and focus goes back to the button that opened it.
  useEffect(() => {
    if (!open) {
      if (wasOpen.current) openButtonRef.current?.focus({ preventScroll: true });
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    const region = regionRef.current;
    region?.setAttribute('inert', '');
    document.documentElement.style.overflow = 'hidden';
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      } else if (event.key === 'Tab' && asideRef.current) {
        const focusable = [...asideRef.current.querySelectorAll<HTMLElement>('a[href], button')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const desktop = window.matchMedia?.(DESKTOP_QUERY);
    const onDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    desktop?.addEventListener('change', onDesktop);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      desktop?.removeEventListener('change', onDesktop);
      document.documentElement.style.overflow = '';
      region?.removeAttribute('inert');
    };
  }, [open]);

  return (
    <div className="min-h-svh bg-page lg:pl-64">
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/35 transition-opacity duration-250 ease-brand motion-reduce:transition-none lg:hidden ${open ? 'visible opacity-100' : 'invisible opacity-0'}`}
      />
      <aside
        ref={asideRef}
        id="admin-menu"
        aria-label={labels.menu}
        // Below 1024 px the menu is a closed dialog until the button opens it; from 1024 px it is part of the page.
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a[href]')) setOpen(false);
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(88%,19rem)] flex-col border-r border-hairline bg-surface transition-[translate,visibility] duration-280 ease-brand motion-reduce:transition-none lg:visible lg:w-64 lg:translate-x-0 ${open ? 'visible translate-x-0 shadow-lg' : 'invisible -translate-x-full'}`}
      >
        <div className="flex min-h-16 flex-none items-center justify-between gap-2 pl-6 pr-4">
          <div className="w-41 min-w-0 max-w-full">{logo}</div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={labels.closeMenu}
            onClick={() => setOpen(false)}
            className="-mr-2 grid size-touch flex-none place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-page hover:text-ink motion-reduce:transition-none lg:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          <nav
            aria-label={labels.menu}
            className="h-full overflow-y-auto overscroll-contain scroll-py-10 px-3 pt-2 pb-8 [scrollbar-color:var(--color-hairline)_transparent] [scrollbar-width:thin]"
          >
            <div className="flex flex-col gap-5">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 pb-1.5 text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = current?.href === item.href;
                      return (
                        <li key={item.href}>
                          <Link
                            prefetch={false}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={itemClass}
                          >
                            {active && (
                              <span
                                aria-hidden="true"
                                className="absolute inset-y-2 -left-3 w-[3px] rounded-r-full bg-accent"
                              />
                            )}
                            <AdminIcon
                              name={item.icon}
                              className="size-5 flex-none text-muted transition-colors duration-150 group-hover:text-ink group-aria-[current=page]:text-accent-text motion-reduce:transition-none"
                            />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {item.badge && item.badge.count > 0 && (
                              <span
                                aria-label={item.badge.label}
                                className="min-w-5 flex-none rounded-full bg-accent px-1.5 text-center text-xs leading-5 font-bold text-on-accent"
                              >
                                {item.badge.count}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface to-transparent"
          />
        </div>
        <div className="flex-none border-t border-hairline px-3 pt-2 pb-3">
          <Link prefetch={false} href="/" target="_blank" rel="noopener" className={itemClass}>
            <AdminIcon
              name="external"
              className="size-5 flex-none text-muted transition-colors duration-150 group-hover:text-ink motion-reduce:transition-none"
            />
            <span className="min-w-0 flex-1 truncate">{labels.viewSite}</span>
          </Link>
          <div className="mt-2 flex items-center gap-3 px-3">
            <span
              aria-hidden="true"
              className="grid size-8 flex-none place-items-center rounded-full bg-accent-tint text-sm font-bold text-accent-text"
            >
              {email.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted" title={email}>
              {email}
            </span>
            <form action={signOut.action} className="flex-none">
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                aria-label={signOut.label}
                title={signOut.label}
                className="-mr-2 grid size-touch place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-page hover:text-ink motion-reduce:transition-none lg:size-9"
              >
                <AdminIcon name="signOut" />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div ref={regionRef} className="flex min-h-svh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-hairline bg-surface/95 backdrop-blur-sm">
          <div className="mx-auto flex min-h-16 w-full max-w-[calc(72rem+2*var(--gutter))] items-center gap-3 px-(--gutter)">
            <button
              ref={openButtonRef}
              type="button"
              aria-label={labels.openMenu}
              aria-expanded={open}
              aria-controls="admin-menu"
              onClick={() => setOpen(true)}
              className="-ml-2 grid size-touch flex-none place-items-center rounded-md text-ink transition-colors duration-150 hover:bg-page motion-reduce:transition-none lg:hidden"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <p className="min-w-0 flex-1 truncate text-base">
              {currentGroup && currentGroup.label !== current?.label && (
                <>
                  <span className="hidden font-medium text-muted sm:inline">{currentGroup.label}</span>
                  <span aria-hidden="true" className="mx-2 hidden text-hairline sm:inline">
                    /
                  </span>
                </>
              )}
              <span className="font-semibold">{current?.label}</span>
            </p>
          </div>
          {/* Inside the header so the notice sits in a landmark. */}
          {demoNotice && (
            <div className="border-t border-hairline bg-accent-tint/60">
              <p className="mx-auto flex w-full max-w-[calc(72rem+2*var(--gutter))] items-center gap-2 px-(--gutter) py-2 text-sm text-ink">
                <AdminIcon name="info" className="size-4 flex-none text-accent-text" />
                {demoNotice}
              </p>
            </div>
          )}
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-(--gutter) py-6 focus:outline-none md:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
