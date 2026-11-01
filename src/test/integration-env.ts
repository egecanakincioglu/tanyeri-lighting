// Connection settings of the integration test database. It is separate from the development database
// (`pnpm db:up` creates the server, the global setup creates this database), so resetting it never touches dev data.
const server = 'postgresql://postgres@127.0.0.1:5432';

export const TEST_DATABASE = 'tanyeri_test';
export const ADMIN_URL = `${server}/postgres`;
export const TEST_URL = `${server}/${TEST_DATABASE}`;

// Test-only values for the authentication variables; they protect nothing.
// The secret has low entropy on purpose so it can never pass for a real one.
export const TEST_AUTH_URL = 'http://localhost:3000';
export const TEST_AUTH_SECRET = 'x'.repeat(32);
