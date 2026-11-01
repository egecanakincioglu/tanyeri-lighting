import { hashPassword } from 'better-auth/crypto';
import { expect } from 'vitest';
import { GET, POST } from '../app/api/auth/[...all]/route.ts';
import { getDb } from '../server/db.ts';
import { TEST_AUTH_URL } from './integration-env.ts';

export const ADMIN_EMAIL = 'admin@example.com';
export const ADMIN_PASSWORD = 'correct horse battery staple';
export const OTHER_PASSWORD = 'another long passphrase 42';

// The limits are per client address and endpoint, so every test uses addresses of its own.
let nextAddress = 1;
function freshAddress(): string {
  return `203.0.113.${nextAddress++}`;
}

export type CallOptions = { address?: string; origin?: string; cookie?: string };

export function authRequest(path: string, body: unknown, options: CallOptions = {}): Request {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: options.origin ?? TEST_AUTH_URL,
    'x-forwarded-for': options.address ?? freshAddress(),
  });
  if (options.cookie) headers.set('cookie', options.cookie);
  return new Request(`${TEST_AUTH_URL}/api/auth${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
}

export function signIn(password: string, options: CallOptions = {}): Promise<Response> {
  return POST(authRequest('/sign-in/email', { email: ADMIN_EMAIL, password }, options));
}

// The name=value pairs of the Set-Cookie headers, ready to send back as a Cookie header.
export function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ');
}

export async function sessionOf(cookie: string): Promise<unknown> {
  const response = await GET(
    new Request(`${TEST_AUTH_URL}/api/auth/get-session`, { headers: { cookie, 'x-forwarded-for': freshAddress() } }),
  );
  return response.json();
}

export async function loginCookie(options: CallOptions = {}): Promise<string> {
  const response = await signIn(ADMIN_PASSWORD, options);
  expect(response.status).toBe(200);
  return cookieOf(response);
}

// Empties every table the authentication tests touch and creates the one admin with ADMIN_PASSWORD.
export async function resetAdmin(): Promise<void> {
  const db = getDb();
  await db.rateLimit.deleteMany();
  await db.verification.deleteMany();
  await db.session.deleteMany();
  await db.account.deleteMany();
  await db.user.deleteMany();
  const user = await db.user.create({
    data: { id: 'user-1', name: 'Admin', email: ADMIN_EMAIL, emailVerified: true },
  });
  await db.account.create({
    data: {
      id: 'account-1',
      accountId: user.id,
      providerId: 'credential',
      userId: user.id,
      password: await hashPassword(ADMIN_PASSWORD),
    },
  });
}
