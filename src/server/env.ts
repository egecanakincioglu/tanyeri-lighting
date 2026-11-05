import { z } from 'zod';
import { MIN_PASSWORD_LENGTH } from '../lib/password-rules.ts';

const databaseUrl = z
  .url({ protocol: /^postgres(ql)?$/ })
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must start with postgres:// or postgresql://');

const envSchema = z.object({
  DATABASE_URL: databaseUrl,
  DATABASE_URL_UNPOOLED: databaseUrl,
  // Signs and encrypts auth data; the library warns below 32 characters.
  BETTER_AUTH_SECRET: z.string().min(32),
  // The only trusted origin and base of every auth URL.
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
});

export type Env = z.infer<typeof envSchema>;

// Sample values from .env.example are fine locally and in CI; only a Vercel deployment refuses them.
const PLACEHOLDER_PREFIX = 'replace-me';

function placeholderProblems(source: Record<string, string | undefined>, names: string[]): string[] {
  if (!isVercel(source)) return [];
  return names
    .filter((name) => source[name]?.startsWith(PLACEHOLDER_PREFIX))
    .map((name) => `${name}: is still the placeholder from .env.example`);
}

// Messages name the variable and the rule, never the value: values can be secrets.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  const problems = result.success
    ? placeholderProblems(source, ['BETTER_AUTH_SECRET'])
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  if (result.success && problems.length === 0) return result.data;
  throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);
}

let cached: Env | undefined;

// Validated on first use, not on import, so `next build` works without the variables.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

const indexingSchema = z.enum(['on', 'off']).default('off');

// Separate from getEnv(): works without the database variables. Read on every call, not cached.
export function isIndexingEnabled(source: Record<string, string | undefined> = process.env): boolean {
  const result = indexingSchema.safeParse(source.SITE_INDEXING);
  if (!result.success) {
    throw new Error('Invalid environment variables:\nSITE_INDEXING: must be "on" or "off"');
  }
  return result.data === 'on';
}

// Same as isIndexingEnabled: no database variables, read on every call.
export function isDevelopment(source: Record<string, string | undefined> = process.env): boolean {
  return source.NODE_ENV === 'development';
}

export function isProduction(source: Record<string, string | undefined> = process.env): boolean {
  return source.NODE_ENV === 'production';
}

// Optional: without it file storage is off. Empty counts as unset.
export function getBlobToken(source: Record<string, string | undefined> = process.env): string | undefined {
  const token = source.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? token : undefined;
}

// Shared by the seed and the recovery command.
// Better Auth stores emails in lower case, so the address is normalised too.
export const adminEmailSchema = z.email().transform((value) => value.toLowerCase());
export const adminPasswordSchema = z.string().min(MIN_PASSWORD_LENGTH);

const adminSchema = z.object({
  ADMIN_EMAIL: adminEmailSchema,
  ADMIN_PASSWORD: adminPasswordSchema,
});

export type AdminCredentials = { email: string; password: string };

// Only the seed needs these, so the running app starts without them. Messages never contain values.
export function getAdminCredentials(source: Record<string, string | undefined> = process.env): AdminCredentials {
  const result = adminSchema.safeParse(source);
  const problems = result.success
    ? placeholderProblems(source, ['ADMIN_PASSWORD'])
    : result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  if (!result.success || problems.length > 0) {
    throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);
  }
  return { email: result.data.ADMIN_EMAIL, password: result.data.ADMIN_PASSWORD };
}

const demoAdminSchema = z.object({
  DEMO_ADMIN_EMAIL: adminEmailSchema,
  DEMO_ADMIN_PASSWORD: adminPasswordSchema,
});

// The read-only demo account shown on its sign-in page. Both or neither; blank counts as unset,
// a partial or invalid pair is an error naming the variable.
export function getDemoAdminCredentials(
  source: Record<string, string | undefined> = process.env,
): AdminCredentials | undefined {
  const email = source.DEMO_ADMIN_EMAIL?.trim() || undefined;
  const password = source.DEMO_ADMIN_PASSWORD || undefined;
  if (email === undefined && password === undefined) return undefined;
  const result = demoAdminSchema.safeParse({ DEMO_ADMIN_EMAIL: email, DEMO_ADMIN_PASSWORD: password });
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);
  }
  return { email: result.data.DEMO_ADMIN_EMAIL, password: result.data.DEMO_ADMIN_PASSWORD };
}

const demoSchema = z.enum(['true', 'false']).default('false');

// Same as isIndexingEnabled: no database variables, read on every call.
export function isDemoMode(source: Record<string, string | undefined> = process.env): boolean {
  const result = demoSchema.safeParse(source.DEMO_MODE);
  if (!result.success) {
    throw new Error('Invalid environment variables:\nDEMO_MODE: must be "true" or "false"');
  }
  return result.data === 'true';
}

export type SmtpConfig = { host: string; port: number; user: string; password: string; from: string };

// A plain address or "Name <address>".
const smtpFrom = z.string().refine((value) => {
  const address = /<([^<>]+)>\s*$/.exec(value)?.[1] ?? value;
  return z.email().safeParse(address.trim()).success;
}, 'must be an email address or "Name <address>"');

const smtpFields = {
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  SMTP_FROM: smtpFrom,
};

const smtpNames = Object.keys(smtpFields) as (keyof typeof smtpFields)[];

// Optional, all or none; without the group email is off. Blank counts as unset.
// A partial group is an error naming the missing variables.
export function getSmtpConfig(source: Record<string, string | undefined> = process.env): SmtpConfig | undefined {
  const values = Object.fromEntries(smtpNames.map((name) => [name, source[name]?.trim() || undefined]));
  if (smtpNames.every((name) => values[name] === undefined)) return undefined;

  const problems: string[] = [];
  for (const name of smtpNames) {
    const value = values[name];
    if (value === undefined) {
      problems.push(`${name}: required when any other SMTP variable is set`);
      continue;
    }
    const result = smtpFields[name].safeParse(value);
    if (!result.success) problems.push(`${name}: ${result.error.issues[0]?.message}`);
  }
  if (problems.length > 0) throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);

  return {
    host: values.SMTP_HOST!,
    port: Number(values.SMTP_PORT),
    user: values.SMTP_USER!,
    password: values.SMTP_PASSWORD!,
    from: values.SMTP_FROM!,
  };
}

export function isEmailEnabled(source: Record<string, string | undefined> = process.env): boolean {
  return getSmtpConfig(source) !== undefined;
}

// Vercel sets VERCEL=1. Headers that only Vercel writes are trusted only where this is true.
export function isVercel(source: Record<string, string | undefined> = process.env): boolean {
  return source.VERCEL === '1';
}

const siteUrlSchema = z.url({ protocol: /^https?$/ });

// Base of canonical links, the sitemap and structured data.
// Without SITE_URL, Vercel's production host is used, else localhost. Only the origin is kept.
export function getSiteUrl(source: Record<string, string | undefined> = process.env): URL {
  const explicit = source.SITE_URL?.trim();
  const host = source.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const value = explicit || (host ? `https://${host}` : 'http://localhost:3000');
  const result = siteUrlSchema.safeParse(value);
  if (!result.success) {
    throw new Error('Invalid environment variables:\nSITE_URL: must be an http(s) address');
  }
  return new URL(new URL(result.data).origin);
}
