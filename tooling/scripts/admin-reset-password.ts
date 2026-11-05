#!/usr/bin/env node
// Resets the admin password read from standard input, for when email is not set up.
//   echo "the new password" | pnpm admin:reset-password --email admin@example.com
import { text } from 'node:stream/consumers';
import { parseArgs } from 'node:util';
import { parseResetInput, resetAdminPassword } from '../../src/server/auth/admin.ts';
import { getDb } from '../../src/server/db.ts';

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { email: { type: 'string' } } });
  if (process.stdin.isTTY) {
    console.error('Type the new password, press Enter, then end the input (Ctrl+D; Ctrl+Z and Enter on Windows).');
  }
  const password = (await text(process.stdin)).replace(/\r?\n$/, '');
  const credentials = parseResetInput(values.email, password);

  const db = getDb();
  try {
    if ((await resetAdminPassword(db, credentials)) === 'unknown') {
      console.error('No admin with that email address.');
      return 1;
    }
  } finally {
    await db.$disconnect();
  }
  console.log(`Password changed for ${credentials.email}. All its sessions ended.`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : 'The command failed.');
    process.exitCode = 1;
  },
);
