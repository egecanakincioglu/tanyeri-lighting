import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The Prisma CLI does not read .env itself; loadEnvFile never overrides a variable that is already set.
if (existsSync('.env')) process.loadEnvFile('.env');

// Not read through getEnv(): `prisma generate` must work without any variable set.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL_UNPOOLED'] ?? '' },
});
