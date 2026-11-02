import { prismaAdapter } from '@better-auth/prisma-adapter';
import { betterAuth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth';
import { MIN_PASSWORD_LENGTH } from '../../lib/password-rules.ts';
import { getDb } from '../db.ts';
import { buildDemoAuthHooks } from '../demo/auth-hooks.ts';
import { sendEmailAfterResponse } from '../email/index.ts';
import { getEnv, isEmailEnabled, isProduction } from '../env.ts';
import { checkRateLimit } from '../rate-limit/index.ts';
import { CHANGE_EMAIL_LIFETIME_SECONDS, changeEmailApprovalEmail, changeEmailEmail } from './change-email-email.ts';
import { RESET_TOKEN_LIFETIME_SECONDS, resetPasswordEmail, resetPasswordLink } from './reset-password-email.ts';

type AuthSettings = { secret: string; baseURL: string; production: boolean; emailEnabled: boolean };

// Reset emails one account may receive.
const RESET_MAIL_LIMIT = { scope: 'reset-mail', limit: 3, windowSeconds: 3600 } as const;

// Every setting of ADR 0003 is written out, so a library default change can not loosen it silently.
export function buildAuthOptions({ secret, baseURL, production, emailEnabled }: AuthSettings) {
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
      // Without it the library answers every reset request with an error and sends nothing: recovery is then
      // a command on the server.
      ...(emailEnabled && {
        // Sent after the response: an existing and an unknown address must answer alike and in the same time.
        // The endpoint limit counts per client address; this one counts per account, so many addresses can not
        // flood one inbox. A refused mail is dropped without a sign: the answer stays the same.
        sendResetPassword: async ({ user, token }: { user: { id: string; email: string }; token: string }) => {
          sendEmailAfterResponse(resetPasswordEmail(user.email, resetPasswordLink(baseURL, token)), async () => {
            const result = await checkRateLimit({ ...RESET_MAIL_LIMIT, subject: user.id });
            return result.ok;
          });
        },
      }),
    },
    // The admin changes the sign-in address from the account screen, in two steps: the current address approves, then
    // the new address gets a link and only that link applies the change, so neither a typo nor a stolen session can
    // move the account. Without email there is no link: the change is off.
    user: {
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
        // The link signs its holder in, so once the address has changed every session ends, the holder's included.
        afterEmailVerification: async (user: { id: string }) => {
          await getDb().session.deleteMany({ where: { userId: user.id } });
        },
      },
    }),
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
