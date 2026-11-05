'use client';

import { useEffect } from 'react';

/** Marks the message read after render, so the page itself writes nothing. */
export function MarkRead({ id, action }: { id: string; action: (id: string) => Promise<void> }) {
  useEffect(() => {
    void action(id);
  }, [id, action]);
  return null;
}
