import { createHash } from 'node:crypto';
import path from 'node:path';

// Connection settings of the integration test database. It is separate from the development database
// (`pnpm db:up` creates the server, the global setup creates this database), so resetting it never touches dev data.
const server = 'postgresql://postgres@127.0.0.1:5432';

// Each checkout (for example each git worktree) gets its own database, so concurrent runs cannot reset each other's.
export function testDatabaseName(root: string): string {
  return `tanyeri_test_${createHash('sha256').update(root).digest('hex').slice(0, 8)}`;
}

export const TEST_DATABASE = testDatabaseName(path.resolve(import.meta.dirname, '..', '..'));
export const ADMIN_URL = `${server}/postgres`;
export const TEST_URL = `${server}/${TEST_DATABASE}`;

// Test-only values for the authentication variables; they protect nothing.
// The secret has low entropy on purpose so it can never pass for a real one.
export const TEST_AUTH_URL = 'http://localhost:3000';
export const TEST_AUTH_SECRET = 'x'.repeat(32);
