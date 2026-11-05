import { notFound } from 'next/navigation';

// Unknown paths must reach the [locale] layout; the static root not-found page cannot carry the CSP nonce.
export default function CatchAllPage() {
  notFound();
}
