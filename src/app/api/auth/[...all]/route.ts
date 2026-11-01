import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '../../../../server/auth/auth.ts';

// The handler is built per request from the cached auth instance, so importing this file (as `next build` does)
// needs no environment variables.
export function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
