import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';
import { getEnv } from './env.ts';

// Kept on globalThis so hot reloads in development reuse one client (and one connection pool).
const holder = globalThis as typeof globalThis & { prismaClient?: PrismaClient };

// Created on first use, not on import, so `next build` works without the variables.
export function getDb(): PrismaClient {
  holder.prismaClient ??= new PrismaClient({
    adapter: new PrismaPg({ connectionString: getEnv().DATABASE_URL }),
  });
  return holder.prismaClient;
}
