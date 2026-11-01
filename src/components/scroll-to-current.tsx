'use client';

import { useEffect, useRef, type ReactNode } from 'react';

type ScrollToCurrentProps = {
  className: string;
  children: ReactNode;
};

/**
 * A list that scrolls its own current item (`aria-current`) to the start edge on mount. Only the list scrolls, never
 * the page, and the jump is instant, so it needs no reduced-motion handling.
 */
export function ScrollToCurrent({ className, children }: ScrollToCurrentProps) {
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const element = list.current;
    const current = element?.querySelector('[aria-current]');
    if (!element || !current || element.scrollWidth <= element.clientWidth) return;
    element.scrollLeft += current.getBoundingClientRect().left - element.getBoundingClientRect().left;
  }, []);

  return (
    <ul ref={list} className={className}>
      {children}
    </ul>
  );
}
