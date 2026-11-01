import { z } from 'zod';

const databaseUrl = z
  .url({ protocol: /^postgres(ql)?$/ })
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must start with postgres:// or postgresql://');

const envSchema = z.object({
  DATABASE_URL: databaseUrl,
  DATABASE_URL_UNPOOLED: databaseUrl,
  // Signs and encrypts auth data; the library warns below 32 characters.
  BETTER_AUTH_SECRET: z.string().min(32),
  // The site's own address: the only trusted origin and the base of every auth URL.
  BETTER_AUTH_URL: z.url({ protocol: /^https?$/ }),
});

export type Env = z.infer<typeof envSchema>;

// Messages name the variable and the rule, never the value: values can be secrets.
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  throw new Error(`Invalid environment variables:\n${problems.join('\n')}`);
}

let cached: Env | undefined;

// Validated on first use, not on import, so `next build` works without the variables.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

const indexingSchema = z.enum(['on', 'off']).default('off');

// Separate from getEnv(): it must work where the database variables are absent (build, site audit).
// Read on every call, not cached, so the value is never frozen at an unexpected moment.
export function isIndexingEnabled(source: Record<string, string | undefined> = process.env): boolean {
  const result = indexingSchema.safeParse(source.SITE_INDEXING);
  if (!result.success) {
    throw new Error('Invalid environment variables:\nSITE_INDEXING: must be "on" or "off"');
  }
  return result.data === 'on';
}

// Same reason as isIndexingEnabled: no database variables needed, read on every call.
export function isDevelopment(source: Record<string, string | undefined> = process.env): boolean {
  return source.NODE_ENV === 'development';
}

export function isProduction(source: Record<string, string | undefined> = process.env): boolean {
  return source.NODE_ENV === 'production';
}
