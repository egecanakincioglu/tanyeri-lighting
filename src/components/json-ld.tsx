import { serializeJsonLd } from '../lib/structured-data.ts';

// The only place a script element is written. The data block is not executed, so it needs no CSP nonce;
// serializeJsonLd escapes `<`.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
