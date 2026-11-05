'use client';

import { lazy, Suspense, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookError } from './book-error.tsx';
import type { ViewerLabels } from './viewer-labels.ts';

// Loaded only once a catalog is opened; if the chunk cannot be fetched, the visitor still gets the PDF.
const CatalogBook = lazy(() =>
  import('./catalog-book.tsx')
    .then((module) => ({ default: module.CatalogBook }))
    .catch(() => ({ default: BookError })),
);

type Props = { url: string; name: string; labels: ViewerLabels; onClose: () => void };

export function CatalogViewer({ url, name, labels, onClose }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const root = document.documentElement;
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = 'hidden';
    root.style.paddingRight = `${scrollbar}px`;
    const outside = [...document.body.children].filter(
      (element) => element !== dialog && !element.hasAttribute('inert'),
    );
    for (const element of outside) element.setAttribute('inert', '');
    closeRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        const focusable = [...dialog.querySelectorAll<HTMLElement>('a[href], button')];
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
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      root.style.overflow = '';
      root.style.paddingRight = '';
      for (const element of outside) element.removeAttribute('inert');
    };
  }, []);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-x-0 top-0 z-60 flex h-dvh flex-col bg-page text-ink"
    >
      <div className="flex flex-none items-center justify-between gap-3 border-b border-hairline bg-surface py-1 pr-2 pl-4 sm:pl-6 [@media(max-height:500px)]:py-0">
        <h2 id={titleId} className="min-w-0 truncate text-lg leading-tight font-bold">
          {name}
        </h2>
        <button
          ref={closeRef}
          type="button"
          aria-label={labels.close}
          onClick={onClose}
          className="grid size-touch flex-none place-items-center rounded-md hover:text-accent-text"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5.5">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <Suspense
        fallback={
          <div className="grid flex-1 place-items-center">
            <p className="text-base text-muted">{labels.loading}</p>
          </div>
        }
      >
        <CatalogBook url={url} name={name} labels={labels} />
      </Suspense>
    </div>,
    document.body,
  );
}
