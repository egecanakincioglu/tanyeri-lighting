import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';
import { ADMIN_URL, TEST_DATABASE, TEST_URL } from './integration-env.ts';

// Recreates the test database, so every run starts from an empty schema.
async function recreateDatabase(): Promise<void> {
  const client = new Client({ connectionString: ADMIN_URL });
  try {
    await client.connect();
  } catch {
    // Vitest 5 crashes while printing the stack of an error thrown from a global setup, so print the hint first.
    const message = 'Integration tests need PostgreSQL on 127.0.0.1:5432; run "pnpm db:up" first.';
    console.error(message);
    throw Object.assign(new Error(message), { stack: message });
  }
  try {
    await client.query(`drop database if exists ${TEST_DATABASE} with (force)`);
    await client.query(`create database ${TEST_DATABASE}`);
  } finally {
    await client.end();
  }
}

export default async function setup(): Promise<void> {
  await recreateDatabase();
  const cli = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL_UNPOOLED: TEST_URL },
    stdio: 'pipe',
  });
}
