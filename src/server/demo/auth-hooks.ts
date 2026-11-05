import { APIError, createAuthMiddleware } from 'better-auth/api';
import { isDemoMode } from '../env.ts';

// Deny list of auth endpoints that change account or session state,
// plus list-sessions (it would show visitors each other's browsers).
// Sign-in, sign-out and read-only lookups stay open. The integration test fails when an endpoint is on neither list.
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
