import { createHash } from 'node:crypto';
import path from 'node:path';

// Separate from the development database, so resets never touch dev data.
const server = 'postgresql://postgres@127.0.0.1:5432';

// Each checkout gets its own database so concurrent runs do not collide.
export function testDatabaseName(root: string): string {
  return `tanyeri_test_${createHash('sha256').update(root).digest('hex').slice(0, 8)}`;
}

export const TEST_DATABASE = testDatabaseName(path.resolve(import.meta.dirname, '..', '..'));
export const ADMIN_URL = `${server}/postgres`;
export const TEST_URL = `${server}/${TEST_DATABASE}`;

// Test-only values; the secret has low entropy on purpose.
export const TEST_AUTH_URL = 'http://localhost:3000';
export const TEST_AUTH_SECRET = 'x'.repeat(32);
