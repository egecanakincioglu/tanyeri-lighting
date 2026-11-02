import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { PrismaClient } from '../../generated/prisma/client.ts';
import { adminEmailSchema, adminPasswordSchema } from '../env.ts';
import type { AdminCredentials } from '../env.ts';

// The rows are written the way Better Auth writes them for an email sign-in: one user and one `credential`
// account whose accountId is the user id and whose password is the library's own hash (ADR 0003 rule 9).
// Sign-up stays closed, so the public endpoint cannot be used for this.
export async function createFirstAdmin(
  db: PrismaClient,
  { email, password }: AdminCredentials,
): Promise<'created' | 'exists'> {
  if (await db.user.findUnique({ where: { email } })) return 'exists';
  const id = randomUUID();
  await db.user.create({
    data: {
      id,
      name: 'Admin',
      email,
      emailVerified: true,
      accounts: {
        create: { id: randomUUID(), accountId: id, providerId: 'credential', password: await hashPassword(password) },
      },
    },
  });
  return 'created';
}

// The demo seed runs again on every deploy, so an existing demo admin gets the configured password back.
export async function upsertDemoAdmin(db: PrismaClient, credentials: AdminCredentials): Promise<'created' | 'updated'> {
  const result = (await createFirstAdmin(db, credentials)) === 'created' ? 'created' : 'updated';
  // Also marks an account that was seeded before the column existed.
  await db.user.update({ where: { email: credentials.email }, data: { isDemo: true } });
  if (result === 'updated') {
    await db.account.updateMany({
      where: { providerId: 'credential', user: { email: credentials.email } },
      data: { password: await hashPassword(credentials.password) },
    });
  }
  return result;
}

// Checks what the recovery command was given. Messages name the field and the rule, never the value.
export function parseResetInput(email: string | undefined, password: string): AdminCredentials {
  const problems: string[] = [];
  const parsedEmail = adminEmailSchema.safeParse(email);
  if (!parsedEmail.success) problems.push('--email: must be a valid email address');
  const parsedPassword = adminPasswordSchema.safeParse(password);
  if (!parsedPassword.success) problems.push('password: must be at least 12 characters');
  if (!parsedEmail.success || !parsedPassword.success) throw new Error(`Invalid input:\n${problems.join('\n')}`);
  return { email: parsedEmail.data, password: parsedPassword.data };
}

// Recovery without email: the new hash is stored and every session of that user ends in one transaction.
export async function resetAdminPassword(
  db: PrismaClient,
  { email, password }: AdminCredentials,
): Promise<'reset' | 'unknown'> {
  const account = await db.account.findFirst({ where: { providerId: 'credential', user: { email } } });
  if (!account) return 'unknown';
  const hash = await hashPassword(password);
  await db.$transaction([
    db.account.update({ where: { id: account.id }, data: { password: hash } }),
    db.session.deleteMany({ where: { userId: account.userId } }),
  ]);
  return 'reset';
}
