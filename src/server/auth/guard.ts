import { hasLocale } from 'next-intl';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { routing } from '../../i18n/routing.ts';
import { getAuth } from './auth.ts';

// The shared authorization check (ADR 0003 rule 7). Every signed-in user is an admin, so a session is all it takes.
// Pages, layouts, Server Actions and route handlers each call the variant for their kind; the proxy never decides
// access. tooling/scripts/check-admin-guard.ts fails CI when one forgets.

async function currentSession() {
  return getAuth().api.getSession({ headers: await headers() });
}

export type AdminSession = NonNullable<Awaited<ReturnType<typeof currentSession>>>;

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

// Pages and layouts: a visitor without a session is sent to the sign-in page. The locale comes from the URL, so an
// unknown value falls back to the default one instead of ending up in the redirect target.
export async function guardPage(locale: string): Promise<AdminSession> {
  const session = await currentSession();
  if (!session) {
    redirect(`/${hasLocale(routing.locales, locale) ? locale : routing.defaultLocale}/dashboard/sign-in`);
  }
  return session;
}

// Server Actions: never a redirect, because the action layer maps the error to a result for the form.
export async function guardAction(): Promise<AdminSession> {
  const session = await currentSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

// Route handlers: the caller returns the response as it is: `if (result instanceof Response) return result;`.
export async function guardHandler(): Promise<AdminSession | Response> {
  const session = await currentSession();
  return session ?? Response.json({ error: 'Unauthorized' }, { status: 401 });
}
