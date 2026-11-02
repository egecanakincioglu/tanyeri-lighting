'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, usePathname } from '../../i18n/navigation.ts';
import type { StaticPath } from '../../i18n/routing.ts';

type FrameItem = { href: StaticPath; label: string; badge?: { count: number; label: string } };
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
  'flex min-h-touch w-full items-center justify-between gap-2 rounded-md px-3 text-left text-[0.9375rem] font-medium text-ink transition-colors duration-150 hover:bg-page aria-[current=page]:bg-accent-tint aria-[current=page]:font-semibold aria-[current=page]:text-accent-text motion-reduce:transition-none';

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
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(88%,19rem)] flex-col overflow-y-auto overscroll-contain border-r border-hairline bg-surface px-3 pt-3 pb-6 transition-[translate,visibility] duration-280 ease-brand motion-reduce:transition-none lg:visible lg:w-64 lg:translate-x-0 ${open ? 'visible translate-x-0 shadow-lg' : 'invisible -translate-x-full'}`}
      >
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          {logo}
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={labels.closeMenu}
            onClick={() => setOpen(false)}
            className="-mr-1 grid size-touch flex-none place-items-center rounded-md hover:text-accent-text lg:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5.5">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <nav aria-label={labels.menu} className="flex flex-col gap-5">
          {groups.map((group, index) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{group.label}</p>
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      prefetch={false}
                      href={item.href}
                      aria-current={current?.href === item.href ? 'page' : undefined}
                      className={itemClass}
                    >
                      {item.label}
                      {item.badge && item.badge.count > 0 && (
                        <span
                          aria-label={item.badge.label}
                          className="min-w-6 rounded-full bg-accent px-1.5 text-center text-xs leading-6 font-bold text-on-accent"
                        >
                          {item.badge.count}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
                {index === groups.length - 1 && (
                  <li>
                    <form action={signOut.action}>
                      <input type="hidden" name="locale" value={locale} />
                      <button type="submit" className={itemClass}>
                        {signOut.label}
                      </button>
                    </form>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div ref={regionRef} className="flex min-h-svh min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-hairline bg-surface">
          <div className="mx-auto flex min-h-16 w-full max-w-[calc(64rem+2*var(--gutter))] items-center gap-3 px-(--gutter)">
            <button
              ref={openButtonRef}
              type="button"
              aria-label={labels.openMenu}
              aria-expanded={open}
              aria-controls="admin-menu"
              onClick={() => setOpen(true)}
              className="-ml-2 grid size-touch flex-none place-items-center rounded-md text-ink hover:text-accent-text lg:hidden"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5.5">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <p className="min-w-0 flex-1 truncate text-base font-bold">{current?.label}</p>
            <Link
              prefetch={false}
              href="/"
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-touch flex-none items-center rounded-md px-2 text-sm font-semibold text-accent-text hover:underline"
            >
              {labels.viewSite}
            </Link>
            <span className="hidden max-w-56 flex-none truncate text-sm text-muted md:block">{email}</span>
          </div>
          {/* Inside the header so the notice sits in a landmark. */}
          {demoNotice && (
            <p className="border-t border-hairline bg-accent-tint px-(--gutter) py-2 text-sm text-ink">{demoNotice}</p>
          )}
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-(--gutter) py-6 focus:outline-none md:py-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
