import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '../../../../server/auth/auth.ts';

// The library rate limits per address and path, so a random path would add a row per request.
// Only the paths a browser calls reach it: the password reset forms and the change-email link.
// Everything else runs on the server and calls the handler directly.
const ALLOWED = {
  GET: new Set(['/api/auth/verify-email']),
  POST: new Set(['/api/auth/request-password-reset', '/api/auth/reset-password']),
} as const;

function allowed(request: Request, method: keyof typeof ALLOWED): boolean {
  return ALLOWED[method].has(new URL(request.url).pathname);
}

const notFound = () => Response.json({ error: 'Not found' }, { status: 404 });

// Built per request, so importing this file (as `next build` does) needs no environment variables.
export function GET(request: Request): Promise<Response> {
  return allowed(request, 'GET') ? toNextJsHandler(getAuth()).GET(request) : Promise.resolve(notFound());
}

export function POST(request: Request): Promise<Response> {
  return allowed(request, 'POST') ? toNextJsHandler(getAuth()).POST(request) : Promise.resolve(notFound());
}
