import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDemoMode } from '../env.ts';
import { getAuth } from './auth.ts';
import { signInPath } from './paths.ts';

// The shared authorization check (ADR 0003 rule 7). Every signed-in user is an admin, so a session is all it takes.
// Pages, layouts, Server Actions and route handlers each call the variant for their kind; the proxy never decides
// access. tooling/scripts/check-admin-guard.ts fails CI when one forgets.

// The session, or null: for the sign-in page, which sends a signed-in visitor on to the panel. The published demo
// account has no session outside demo mode, whatever the library accepted at sign-in, so a demo database that reaches
// production with the variable off or missing opens nothing.
export async function currentSession() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session?.user.isDemo && !isDemoMode()) return null;
  return session;
}

export type AdminSession = NonNullable<Awaited<ReturnType<typeof currentSession>>>;

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

// Pages and layouts: a visitor without a session is sent to the sign-in page of the same language. The target is built
// from the locale alone (an unknown one falls back to the default), never from the request.
export async function guardPage(locale: string): Promise<AdminSession> {
  const session = await currentSession();
  if (!session) {
    redirect(signInPath(locale));
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
