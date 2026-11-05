'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Counts a view only when the page really opens in a browser:
// prefetches and crawlers without script never reach this effect.
// Keep it tiny; the home page is close to its weight budget.
export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    navigator.sendBeacon('/api/visits', pathname);
  }, [pathname]);
  return null;
}
