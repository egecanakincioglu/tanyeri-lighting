import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The Prisma CLI does not read .env; loadEnvFile keeps variables that are already set.
if (existsSync('.env')) process.loadEnvFile('.env');

// Not getEnv(): `prisma generate` must work without any variable set.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.ts' },
  datasource: { url: process.env['DATABASE_URL_UNPOOLED'] ?? '' },
});
