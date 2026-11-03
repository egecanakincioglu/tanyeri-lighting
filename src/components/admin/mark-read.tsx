'use client';

import { useEffect } from 'react';

/** Opening a message reads it: one call after the page shows, so the page itself writes nothing. */
export function MarkRead({ id, action }: { id: string; action: (id: string) => Promise<void> }) {
  useEffect(() => {
    void action(id);
  }, [id, action]);
  return null;
}
