import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isDemoMode } from '../env.ts';
import { getAuth } from './auth.ts';
import { signInPath } from './paths.ts';

// Shared authorization check: every signed-in user is an admin, so a session is enough.
// Each kind of caller uses its own variant; the proxy never decides access.
// check-admin-guard.ts fails CI when one is missed.

// Session or null, for the sign-in page.
// The demo account has no session outside demo mode, so a demo database in production opens nothing.
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

// Pages and layouts: no session redirects to the sign-in page of the same locale.
// The target is built from the locale alone, never from the request.
export async function guardPage(locale: string): Promise<AdminSession> {
  const session = await currentSession();
  if (!session) {
    redirect(signInPath(locale));
  }
  return session;
}

// Server Actions: never a redirect; the action layer maps the error to a form result.
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
