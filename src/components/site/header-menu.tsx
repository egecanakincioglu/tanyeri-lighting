'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, usePathname } from '../../i18n/navigation.ts';
import type { StaticPath, routing } from '../../i18n/routing.ts';
import { CONTAINER } from './container.ts';

export type MenuLink = { label: string; href: StaticPath };
export type MenuItem = { label: string; href?: StaticPath; children?: MenuLink[] };

type Locale = (typeof routing.locales)[number];

type Props = {
  locale: string;
  logo: ReactNode;
  items: MenuItem[];
  contact: MenuLink;
  languages: { locale: Locale; code: string; name: string }[];
  labels: { language: string; menu: string; openMenu: string; closeMenu: string };
};

const HOVER_INTENT_MS = 90;
const HOVER_CLOSE_MS = 220;
const DESKTOP_QUERY = '(min-width: 64rem)';

type OpenedBy = 'hover' | 'click' | 'key';

// `pathname` and `href` are keys of the routing table, so the language does not matter here.
function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function Chevron({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-3 flex-none opacity-70 ${className}`}>
      <path d="M3 5.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const linkClass =
  'relative flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-[0.9375rem] font-medium whitespace-nowrap text-ink transition-colors duration-150 ease-brand hover:bg-page aria-expanded:bg-page aria-[current=page]:font-semibold aria-[current=page]:text-accent-text data-current:font-semibold data-current:text-accent-text motion-reduce:transition-none';
// The hidden bold copy of the label reserves its width, so the heavier current item does not shift the menu.
const labelClass =
  'inline-flex flex-col items-center select-none after:invisible after:block after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-t)]';

export function HeaderMenu({ locale, logo, items, contact, languages, labels }: Props) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState<Record<number, boolean>>({});

  const openedBy = useRef<OpenedBy | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingFocus = useRef<{ index: number; last: boolean } | null>(null);
  const navRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sideRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sideWasOpen = useRef(false);

  const here = (href: string) => isCurrent(pathname, href);

  // The shadow appears after 4 px of scroll; nothing else changes, so the bar never moves the page.
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 4);
      openedBy.current = null;
      setOpenDropdown(null);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-dropdown]')) setOpenDropdown(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const pending = pendingFocus.current;
    if (pending && openDropdown === pending.index) {
      pendingFocus.current = null;
      focusLink(navRef.current?.querySelector(`[data-dropdown="${pending.index}"]`), pending.last);
    }
  }, [openDropdown]);

  useEffect(() => {
    if (!sideOpen) {
      if (sideWasOpen.current) menuButtonRef.current?.focus({ preventScroll: true });
      sideWasOpen.current = false;
      return;
    }
    sideWasOpen.current = true;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = 'hidden';
    root.style.paddingRight = `${scrollbar}px`;
    const outside = [barRef.current, ...document.querySelectorAll('[data-page-region]')];
    for (const element of outside) element?.setAttribute('inert', '');
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSideOpen(false);
      } else if (event.key === 'Tab' && sideRef.current) {
        const focusable = [...sideRef.current.querySelectorAll<HTMLElement>('a[href], button')].filter(
          (element) => !element.closest('[inert]'),
        );
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
      if (event.matches) setSideOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    desktop?.addEventListener('change', onDesktop);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      desktop?.removeEventListener('change', onDesktop);
      root.style.overflow = '';
      root.style.paddingRight = '';
      for (const element of outside) element?.removeAttribute('inert');
    };
  }, [sideOpen]);

  function focusLink(item: Element | null | undefined, last: boolean) {
    const links = item ? [...item.querySelectorAll<HTMLElement>('ul a')] : [];
    (last ? links[links.length - 1] : links[0])?.focus();
  }

  function show(index: number, by: OpenedBy) {
    clearTimeout(timer.current);
    openedBy.current = by;
    setOpenDropdown(index);
  }

  function hide(index: number) {
    clearTimeout(timer.current);
    openedBy.current = null;
    setOpenDropdown((current) => (current === index ? null : current));
  }

  function onPointerEnter(index: number, pointerType: string) {
    if (pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    // Moving between two menus switches at once; the first one waits for the pointer to settle.
    if ((openDropdown !== null && openDropdown !== index) || prefersReducedMotion()) show(index, 'hover');
    else timer.current = setTimeout(() => show(index, 'hover'), HOVER_INTENT_MS);
  }

  function onPointerLeave(index: number, pointerType: string) {
    if (pointerType !== 'mouse') return;
    clearTimeout(timer.current);
    if (openedBy.current === 'hover' && openDropdown === index) {
      timer.current = setTimeout(() => hide(index), HOVER_CLOSE_MS);
    }
  }

  function onTriggerClick(index: number) {
    if (openDropdown !== index) show(index, 'click');
    // A menu opened by hover and then clicked stays open.
    else if (openedBy.current === 'hover') openedBy.current = 'click';
    else hide(index);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const last = event.key === 'ArrowUp';
    if (openDropdown === index) {
      focusLink(event.currentTarget.closest('[data-dropdown]'), last);
    } else {
      pendingFocus.current = { index, last };
      show(index, 'key');
    }
  }

  function onItemKeyDown(event: KeyboardEvent<HTMLLIElement>, index: number) {
    const item = event.currentTarget;
    const links = [...item.querySelectorAll<HTMLElement>('ul a')];
    const at = links.findIndex((link) => link === document.activeElement);
    const trigger = item.querySelector<HTMLElement>('button');
    if (event.key === 'Escape' && openDropdown === index) {
      event.preventDefault();
      hide(index);
      trigger?.focus();
    } else if (at > -1 && event.key === 'ArrowDown') {
      event.preventDefault();
      links[(at + 1) % links.length]?.focus();
    } else if (at > -1 && event.key === 'ArrowUp') {
      event.preventDefault();
      (at === 0 ? trigger : links[at - 1])?.focus();
    } else if (at > -1 && event.key === 'Home') {
      event.preventDefault();
      links[0]?.focus();
    } else if (at > -1 && event.key === 'End') {
      event.preventDefault();
      links[links.length - 1]?.focus();
    }
  }

  return (
    <header
      className={`sticky top-0 z-50 border-b border-hairline bg-surface transition-shadow duration-200 ease-brand [@media(max-height:500px)]:static motion-reduce:transition-none ${scrolled ? 'shadow-[0_4px_16px_rgb(0_0_0/0.05)]' : ''}`}
    >
      <div ref={barRef} className={`${CONTAINER} flex h-16 items-center gap-2 md:h-17 lg:h-18`}>
        {logo}
        <nav aria-label={labels.menu} className="ml-auto hidden h-full lg:block">
          <ul ref={navRef} className="flex h-full gap-[clamp(0.25rem,0.6vw,0.75rem)]">
            {items.map((item, index) =>
              item.children ? (
                <li
                  key={item.label}
                  data-dropdown={index}
                  className="relative flex items-center"
                  onPointerEnter={(event) => onPointerEnter(index, event.pointerType)}
                  onPointerLeave={(event) => onPointerLeave(index, event.pointerType)}
                  onKeyDown={(event) => onItemKeyDown(event, index)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hide(index);
                  }}
                >
                  <button
                    type="button"
                    className={linkClass}
                    aria-expanded={openDropdown === index}
                    aria-haspopup="true"
                    data-current={item.children.some((child) => here(child.href)) ? '' : undefined}
                    onClick={() => onTriggerClick(index)}
                    onKeyDown={(event) => onTriggerKeyDown(event, index)}
                  >
                    <span className={labelClass} data-t={item.label}>
                      {item.label}
                    </span>
                    <Chevron
                      className={`transition-transform duration-200 ${openDropdown === index ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <ul
                    className={`absolute top-full left-1/2 min-w-52 -translate-x-1/2 rounded-b-lg border border-t-0 border-hairline bg-surface p-1.5 shadow-[0_10px_24px_rgb(0_0_0/0.07)] transition-[opacity,translate,visibility] duration-180 ease-brand motion-reduce:transition-none ${openDropdown === index ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1.5 opacity-0'}`}
                  >
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          prefetch={false}
                          href={child.href}
                          aria-current={here(child.href) ? 'page' : undefined}
                          className="flex min-h-touch items-center rounded-md px-3.5 text-[0.9rem] font-medium whitespace-nowrap hover:bg-page hover:text-accent-text focus-visible:bg-page aria-[current=page]:text-accent-text"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.label} className="relative flex items-center">
                  <Link
                    prefetch={false}
                    href={item.href ?? '/'}
                    className={linkClass}
                    aria-current={item.href && here(item.href) ? 'page' : undefined}
                  >
                    <span className={labelClass} data-t={item.label}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <Link
          prefetch={false}
          href={contact.href}
          aria-current={here(contact.href) ? 'page' : undefined}
          className="ml-4 hidden min-h-touch items-center justify-center rounded-md bg-accent-tint px-4.5 text-sm font-semibold text-accent-text transition-colors duration-200 hover:bg-accent hover:text-on-accent lg:inline-flex"
        >
          {contact.label}
        </Link>
        <div className="ml-auto flex items-center gap-1 lg:ml-2">
          <div role="group" aria-label={labels.language} className="flex items-center">
            {languages.map((language, index) => (
              <Link
                prefetch={false}
                key={language.locale}
                href={pathname as StaticPath}
                locale={language.locale}
                lang={language.locale}
                hrefLang={language.locale}
                aria-label={language.name}
                aria-current={language.locale === locale ? 'true' : undefined}
                className={`relative flex min-h-touch min-w-10 items-center justify-center px-2 text-[0.8125rem] tracking-wide transition-colors duration-200 hover:text-ink motion-reduce:transition-none ${language.locale === locale ? 'font-bold text-ink' : 'font-medium text-muted'} ${index > 0 ? 'before:absolute before:top-1/2 before:left-0 before:-mt-1.5 before:h-3 before:w-px before:bg-hairline' : ''}`}
              >
                {language.code}
              </Link>
            ))}
          </div>
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={labels.openMenu}
            aria-expanded={sideOpen}
            aria-controls="side-menu"
            onClick={() => setSideOpen(true)}
            className="grid size-touch place-items-center rounded-md text-ink hover:text-accent-text lg:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5.5">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div
        aria-hidden="true"
        onClick={() => setSideOpen(false)}
        className={`fixed inset-0 bg-black/35 transition-opacity duration-250 ease-brand motion-reduce:transition-none ${sideOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
      />
      <div
        ref={sideRef}
        id="side-menu"
        role="dialog"
        aria-modal="true"
        aria-label={labels.menu}
        inert={!sideOpen}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a[href]')) setSideOpen(false);
        }}
        className={`fixed top-0 right-0 flex h-full w-[min(85%,24rem)] flex-col overflow-y-auto overscroll-contain bg-surface px-5 pt-3 pb-8 shadow-lg transition-[translate,visibility] duration-280 ease-brand motion-reduce:transition-none xs:w-[min(60%,24rem)] xs:px-6 ${sideOpen ? 'visible translate-x-0' : 'invisible translate-x-full'}`}
      >
        <div className="mb-3 flex items-center justify-between">
          {logo}
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={labels.closeMenu}
            onClick={() => setSideOpen(false)}
            className="-mr-2 grid size-touch place-items-center rounded-md hover:text-accent-text"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5.5">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {items.map((item, index) =>
          item.children ? (
            <div key={item.label}>
              <button
                type="button"
                aria-expanded={groupsOpen[index] === true}
                aria-controls={`side-group-${index}`}
                data-current={item.children.some((child) => here(child.href)) ? '' : undefined}
                onClick={() => setGroupsOpen((current) => ({ ...current, [index]: !current[index] }))}
                className="flex min-h-12.5 w-full items-center justify-between gap-2 border-t border-hairline text-left text-base font-medium hover:text-accent-text data-current:font-semibold data-current:text-accent-text"
              >
                {item.label}
                <Chevron className={`transition-transform duration-220 ${groupsOpen[index] ? 'rotate-180' : ''}`} />
              </button>
              <div
                id={`side-group-${index}`}
                inert={!groupsOpen[index]}
                className={`grid transition-[grid-template-rows] duration-240 ease-brand motion-reduce:transition-none ${groupsOpen[index] ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="flex flex-col overflow-hidden pb-1">
                  {item.children.map((child) => (
                    <Link
                      prefetch={false}
                      key={child.href}
                      href={child.href}
                      aria-current={here(child.href) ? 'page' : undefined}
                      className="flex min-h-touch items-center pl-4 text-[0.9375rem] text-muted hover:text-accent-text aria-[current=page]:font-semibold aria-[current=page]:text-accent-text"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Link
              prefetch={false}
              key={item.label}
              href={item.href ?? '/'}
              aria-current={item.href && here(item.href) ? 'page' : undefined}
              className="flex min-h-12.5 items-center border-t border-hairline text-base font-medium hover:text-accent-text aria-[current=page]:font-semibold aria-[current=page]:text-accent-text"
            >
              {item.label}
            </Link>
          ),
        )}
        <Link
          prefetch={false}
          href={contact.href}
          aria-current={here(contact.href) ? 'page' : undefined}
          className="mt-5 flex min-h-touch items-center justify-center rounded-md bg-accent-tint text-[0.9375rem] font-semibold text-accent-text hover:bg-accent hover:text-on-accent"
        >
          {contact.label}
        </Link>
      </div>
    </header>
  );
}
