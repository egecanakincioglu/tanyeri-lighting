import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '../../../../server/auth/auth.ts';

// The library rate limits before it matches the route, keyed by address and path, so a random path would write a
// new row per request. Only what a browser really calls reaches it: the two forms of the password reset (posted
// from the browser, see reset-forms.tsx) and the link of the change-email mail (opened in the browser). Sign-in,
// sign-out and the account actions run on the server and call the handler directly (call.ts), the session is read
// with `auth.api`, and the reset mail links to a panel page, so none of those need this route.
const ALLOWED = {
  GET: new Set(['/api/auth/verify-email']),
  POST: new Set(['/api/auth/request-password-reset', '/api/auth/reset-password']),
} as const;

function allowed(request: Request, method: keyof typeof ALLOWED): boolean {
  return ALLOWED[method].has(new URL(request.url).pathname);
}

const notFound = () => Response.json({ error: 'Not found' }, { status: 404 });

// The handler is built per request from the cached auth instance, so importing this file (as `next build` does)
// needs no environment variables.
export function GET(request: Request): Promise<Response> {
  return allowed(request, 'GET') ? toNextJsHandler(getAuth()).GET(request) : Promise.resolve(notFound());
}

export function POST(request: Request): Promise<Response> {
  return allowed(request, 'POST') ? toNextJsHandler(getAuth()).POST(request) : Promise.resolve(notFound());
}
