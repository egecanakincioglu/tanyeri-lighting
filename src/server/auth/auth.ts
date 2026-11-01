import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { getDb } from '../db.ts';
import { getEnv, isProduction } from '../env.ts';

type AuthSettings = { secret: string; baseURL: string; production: boolean };

// Every setting of ADR 0003 is written out, so a library default change can not loosen it silently.
export function buildAuthOptions({ secret, baseURL, production }: AuthSettings) {
  return {
    secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
    },
    rateLimit: { enabled: true, storage: 'database' },
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
    ...buildAuthOptions({ secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL, production: isProduction() }),
    database: prismaAdapter(getDb(), { provider: 'postgresql' }),
  });
}

let cached: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  cached ??= createAuth();
  return cached;
}
