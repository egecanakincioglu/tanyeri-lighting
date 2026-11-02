import { APIError, createAuthMiddleware } from 'better-auth/api';
import { isDemoMode } from '../env.ts';

// Every Better Auth 1.7.14 core endpoint that changes account or session state, and list-sessions, which would show
// every demo visitor the addresses and browsers of the others sharing the account. Sign-in, sign-out, get-session and the
// read-only lookups stay open; sign-up is closed by the auth options. It is a deny list so the demo admin keeps
// working when the library adds a read-only endpoint; the integration test fails when an endpoint is in neither
// list, so a library upgrade can not add a write endpoint unnoticed.
export const DEMO_BLOCKED_AUTH_PATHS: ReadonlySet<string> = new Set([
  '/change-password',
  '/change-email',
  '/update-user',
  '/update-session',
  '/delete-user',
  '/delete-user/callback',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
  '/verify-email',
  '/list-sessions',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',
  '/link-social',
  '/unlink-account',
  '/refresh-token',
  '/get-access-token',
]);

// Demo mode is read when the request runs, not when the auth instance is created.
export function buildDemoAuthHooks() {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (isDemoMode() && DEMO_BLOCKED_AUTH_PATHS.has(ctx.path)) {
        throw new APIError('FORBIDDEN', { message: 'This action is disabled in demo mode' });
      }
    }),
  };
}
