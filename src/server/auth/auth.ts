import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { MIN_PASSWORD_LENGTH } from '../../lib/password-rules.ts';
import { getDb } from '../db.ts';
import { buildDemoAuthHooks } from '../demo/auth-hooks.ts';
import { sendEmailAfterResponse } from '../email/index.ts';
import { getEnv, isDemoMode, isEmailEnabled, isProduction } from '../env.ts';
import { checkRateLimit } from '../rate-limit/index.ts';
import { CHANGE_EMAIL_LIFETIME_SECONDS, changeEmailApprovalEmail, changeEmailEmail } from './change-email-email.ts';
import { RESET_TOKEN_LIFETIME_SECONDS, resetPasswordEmail, resetPasswordLink } from './reset-password-email.ts';

type AuthSettings = { secret: string; baseURL: string; production: boolean; emailEnabled: boolean; demo?: boolean };

// Demo sessions are short because the demo login is open to scripts.
const DEMO_SESSION_SECONDS = 60 * 60;

const RESET_MAIL_LIMIT = { scope: 'reset-mail', limit: 3, windowSeconds: 3600 } as const;

// Every setting is written out, so a library default change cannot loosen it silently.
export function buildAuthOptions({ secret, baseURL, production, emailEnabled, demo = false }: AuthSettings) {
  return {
    secret,
    baseURL,
    trustedOrigins: [new URL(baseURL).origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      disableSignUp: true,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_TOKEN_LIFETIME_SECONDS,
      // Without it the library rejects every reset request; recovery is then a server command.
      ...(emailEnabled && {
        // Sent after the response, so an existing and an unknown address answer alike and in the same time.
        // This limit is per account, so many addresses cannot flood one inbox. A refused mail is dropped silently.
        sendResetPassword: async ({ user, token }: { user: { id: string; email: string }; token: string }) => {
          sendEmailAfterResponse(resetPasswordEmail(user.email, resetPasswordLink(baseURL, token)), async () => {
            const result = await checkRateLimit({ ...RESET_MAIL_LIMIT, subject: user.id });
            return result.ok;
          });
        },
      }),
    },
    // Reset tokens are stored as a hash, so a copy of the table cannot reset a password.
    verification: { storeIdentifier: 'hashed' },
    // Email change: the current address approves, then the new address confirms by link.
    // The form needs the current password. Off without email.
    // `input: false` keeps every endpoint, update-user included, from setting `isDemo`.
    user: {
      additionalFields: { isDemo: { type: 'boolean', required: false, defaultValue: false, input: false } },
      changeEmail: {
        enabled: emailEnabled,
        ...(emailEnabled && {
          sendChangeEmailConfirmation: async ({
            user,
            newEmail,
            url,
          }: {
            user: { email: string };
            newEmail: string;
            url: string;
          }) => {
            sendEmailAfterResponse(changeEmailApprovalEmail(user.email, newEmail, url));
          },
        }),
      },
    },
    ...(emailEnabled && {
      emailVerification: {
        expiresIn: CHANGE_EMAIL_LIFETIME_SECONDS,
        sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
          sendEmailAfterResponse(changeEmailEmail(user.email, url));
        },
        // The link signs its holder in, so every session ends after the change, the holder's included.
        afterEmailVerification: async (user: { id: string }) => {
          await getDb().session.deleteMany({ where: { userId: user.id } });
        },
      },
    }),
    // Limits are written out, not left to library defaults. Each is per client address, window in seconds.
    rateLimit: {
      enabled: true,
      storage: 'database',
      customRules: {
        '/sign-in/email': { window: 10, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/reset-password': { window: 60, max: 5 },
      },
    },
    // Sessions are never trusted from the cookie alone, so a revoked one stops working at once.
    session: { cookieCache: { enabled: false }, ...(demo && { expiresIn: DEMO_SESSION_SECONDS }) },
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
      demo: isDemoMode(),
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
