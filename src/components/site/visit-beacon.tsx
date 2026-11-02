'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Counts a page view once the page is really opened in a browser: prefetches and crawlers that run no script never
// reach this effect. It stays tiny on purpose; the home page is close to its weight budget (ADR 0009).
export function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    navigator.sendBeacon('/api/visits', pathname);
  }, [pathname]);
  return null;
}
