import { defineConfig } from 'prisma/config';

// Not read through getEnv(): `prisma generate` must work without any variable set.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env['DATABASE_URL_UNPOOLED'] ?? '' },
});
