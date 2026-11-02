'use client';

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ButtonLink } from '../button.tsx';
import type { ViewerLabels } from './viewer-labels.ts';
import { CatalogViewer } from './catalog-viewer.tsx';

type Props = { href: string; name: string; label: string; labels: ViewerLabels; children: ReactNode };

/** A link to the PDF that opens the page-flip viewer instead when scripts are running. */
export function CatalogView({ href, name, label, labels, children }: Props) {
  const [open, setOpen] = useState(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open && wasOpen.current) linkRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle new-tab and new-window clicks.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOpen(true);
  }

  return (
    <>
      <ButtonLink
        ref={linkRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        prefetch={false}
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </ButtonLink>
      {open && <CatalogViewer url={href} name={name} labels={labels} onClose={() => setOpen(false)} />}
    </>
  );
}
