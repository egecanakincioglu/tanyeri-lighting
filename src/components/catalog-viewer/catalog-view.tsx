'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ButtonLink } from '../button.tsx';
import { Card } from '../card.tsx';
import type { ViewerLabels } from './viewer-labels.ts';
import { CatalogViewer } from './catalog-viewer.tsx';

type Props = {
  href: string;
  name: string;
  /** Text of the size line, for example "PDF, 2.4 MB". */
  detail: string;
  label: string;
  labels: ViewerLabels;
  /** The cover picture, or the placeholder; it fills a portrait box and opens the viewer like the view link. */
  cover: ReactNode;
  /** The download link; it needs no script, so the page builds it. */
  download: ReactNode;
  children: ReactNode;
};

/** A catalog card whose view link, and its cover, open the page-flip viewer instead when scripts are running. */
export function CatalogView({ href, name, detail, label, labels, cover, download, children }: Props) {
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
      <div className="h-full rounded-lg duration-300 motion-safe:transition-shadow motion-safe:hover:shadow-[0_8px_16px_rgb(0_0_0/0.12)] motion-safe:hover:[&>article]:shadow-none">
        <Card>
          {/* The view link below carries the name; this one is a pointer shortcut, so it is not a second tab stop. */}
          <Link
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            prefetch={false}
            tabIndex={-1}
            aria-hidden="true"
            onClick={onClick}
            className="relative block aspect-[210/297] flex-none overflow-hidden motion-safe:[&_img]:transition-transform motion-safe:[&_img]:duration-400 motion-safe:group-hover:[&_img]:scale-[1.06]"
          >
            {cover}
          </Link>
          <div className="flex flex-1 flex-col gap-4 p-4.5 sm:p-5">
            <div>
              <h2 className="text-xl leading-tight font-bold text-ink">{name}</h2>
              <p className="mt-1 text-[0.95rem] text-muted">{detail}</p>
            </div>
            <div className="mt-auto flex flex-wrap gap-3">
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
              {download}
            </div>
          </div>
        </Card>
      </div>
      {open && <CatalogViewer url={href} name={name} labels={labels} onClose={() => setOpen(false)} />}
    </>
  );
}
