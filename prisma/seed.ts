// Creates the first admin from ADMIN_EMAIL and ADMIN_PASSWORD: `pnpm db:seed`. Safe to run again.
import { createFirstAdmin } from '../src/server/auth/admin.ts';
import { getDb } from '../src/server/db.ts';
import { getAdminCredentials } from '../src/server/env.ts';

try {
  const db = getDb();
  try {
    const result = await createFirstAdmin(db, getAdminCredentials());
    console.log(
      result === 'created' ? 'Created the first admin.' : 'An admin with that email already exists; nothing changed.',
    );
  } finally {
    await db.$disconnect();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The seed failed.');
  process.exitCode = 1;
}
