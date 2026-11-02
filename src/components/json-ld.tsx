import { serializeJsonLd } from '../lib/structured-data.ts';

// The only place a script element is written (see tooling/semgrep). The data block is not executed, so the CSP nonce is
// not needed; the text goes through serializeJsonLd, which escapes `<`.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
