import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing.ts';
import { isDevelopment } from './server/env.ts';

const intlProxy = createMiddleware(routing);

function buildCsp(nonce: string): string {
  // React needs eval for debugging aids in development only.
  const devEval = isDevelopment() ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${devEval}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // The PDF reader runs in a worker from the site's own origin.
    "worker-src 'self'",
    // The catalog reader fetches PDFs cross-origin; uploads go to the store API at vercel.com/api/blob/.
    "connect-src 'self' https://*.public.blob.vercel-storage.com https://vercel.com/api/blob/",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export default function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  // next-intl copies request headers into the response; Next.js reads the nonce from there.
  request.headers.set('content-security-policy', csp);
  const response = intlProxy(request);
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*[.].*).*)'],
};
