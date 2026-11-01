import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { getDb } from '../db.ts';
import { buildDemoAuthHooks } from '../demo/auth-hooks.ts';
import { sendEmailAfterResponse } from '../email/index.ts';
import { getEnv, isEmailEnabled, isProduction } from '../env.ts';
import { RESET_TOKEN_LIFETIME_SECONDS, resetPasswordEmail, resetPasswordLink } from './reset-password-email.ts';

type AuthSettings = { secret: string; baseURL: string; production: boolean; emailEnabled: boolean };

// Every setting of ADR 0003 is written out, so a library default change can not loosen it silently.
export function buildAuthOptions({ secret, baseURL, production, emailEnabled }: AuthSettings) {
  return {
    secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_LIFETIME_SECONDS,
      // Without it the library answers every reset request with an error and sends nothing: recovery is then
      // a command on the server.
      ...(emailEnabled && {
        // Sent after the response: an existing and an unknown address must answer alike and in the same time.
        sendResetPassword: async ({ user, token }: { user: { email: string }; token: string }) => {
          sendEmailAfterResponse(resetPasswordEmail(user.email, resetPasswordLink(baseURL, token)));
        },
      }),
    },
    // ADR 0004 rule 1: the limits of the sign-in and password reset endpoints are written out, not left to the
    // library defaults. Each is per client address, with the window in seconds.
    rateLimit: {
      enabled: true,
      storage: 'database',
      customRules: {
        '/sign-in/email': { window: 10, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/reset-password': { window: 60, max: 5 },
      },
    },
    // A revoked session must stop working at once, so the session is never trusted from the cookie alone.
    session: { cookieCache: { enabled: false } },
    // The library skips the origin check in the test environment unless told otherwise; both stay on everywhere.
    advanced: { useSecureCookies: production, disableOriginCheck: false, disableCSRFCheck: false },
  } satisfies BetterAuthOptions;
}

// Created on first use, not on import, so `next build` works without the variables.
function createAuth() {
  const env = getEnv();
  return betterAuth({
    ...buildAuthOptions({
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      production: isProduction(),
      emailEnabled: isEmailEnabled(),
    }),
    database: prismaAdapter(getDb(), { provider: 'postgresql' }),
    hooks: buildDemoAuthHooks(),
  });
}

let cached: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  cached ??= createAuth();
  return cached;
}
