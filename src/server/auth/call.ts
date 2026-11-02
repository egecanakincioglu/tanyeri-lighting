import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { cookies, headers } from 'next/headers';
import { getEnv } from '../env.ts';
import { getAuth } from './auth.ts';

// Server Actions call the endpoints through the library's request handler, not through `auth.api`: only the handler
// applies the rate limits and the origin check of the auth options. The browser's cookie and client address are
// passed on, and the cookies of the answer are written to the browser by hand, because the handler only returns them.
export async function callAuth(
  path: '/sign-in/email' | '/sign-out' | '/change-password' | '/revoke-other-sessions' | '/change-email',
  body: object,
): Promise<Response> {
  const incoming = await headers();
  const { BETTER_AUTH_URL } = getEnv();
  const outgoing = new Headers({
    'content-type': 'application/json',
    origin: new URL(BETTER_AUTH_URL).origin,
  });
  for (const name of ['cookie', 'x-forwarded-for']) {
    const value = incoming.get(name);
    if (value) outgoing.set(name, value);
  }
  const response = await getAuth().handler(
    new Request(new URL(`/api/auth${path}`, BETTER_AUTH_URL), {
      method: 'POST',
      headers: outgoing,
      body: JSON.stringify(body),
    }),
  );

  const lines = response.headers.getSetCookie();
  if (lines.length > 0) {
    const store = await cookies();
    for (const line of lines) {
      for (const [name, attributes] of parseSetCookieHeader(line)) {
        store.set(name, attributes.value, toCookieOptions(attributes));
      }
    }
  }
  return response;
}
