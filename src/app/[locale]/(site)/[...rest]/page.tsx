import { notFound } from 'next/navigation';

// Unknown paths must reach the dynamic [locale] layout; the root not-found page is static and cannot carry the CSP nonce.
export default function CatchAllPage() {
  notFound();
}
