import { z } from 'zod';

const databaseUrl = z
  .url({ protocol: /^postgres(ql)?$/ })
  .refine((value) => /^postgres(ql)?:\/\//.test(value), 'must start with postgres:// or postgresql://');

const envSchema = z.object({
  DATABASE_URL: databaseUrl,
  DATABASE_URL_UNPOOLED: databaseUrl,
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
