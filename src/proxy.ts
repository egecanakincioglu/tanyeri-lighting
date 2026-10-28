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
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export default function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  // next-intl copies the request headers into the rewrite/next response, which is how
  // Next.js reads the nonce to apply it to its own scripts.
  request.headers.set('content-security-policy', csp);
  const response = intlProxy(request);
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next|.*[.].*).*)'],
};
