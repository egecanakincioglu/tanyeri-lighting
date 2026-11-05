// Fills the site with fictional demo content: `pnpm db:seed:demo`.
// Refuses when content exists unless run with --replace or DEMO_MODE=true.
import { upsertDemoAdmin } from '../src/server/auth/admin.ts';
import { getDb } from '../src/server/db.ts';
import { getDemoAdminCredentials, isDemoMode } from '../src/server/env.ts';
import { seedDemoContent } from './demo-content.ts';

try {
  const db = getDb();
  try {
    const counts = await seedDemoContent(db, { replace: process.argv.includes('--replace') || isDemoMode() });
    console.log(
      `Seeded the demo content: ${counts.products} products in ${counts.categories} categories, ${counts.projects} projects.`,
    );
    const demoAdmin = getDemoAdminCredentials();
    if (demoAdmin) {
      console.log(`Demo admin ${await upsertDemoAdmin(db, demoAdmin)}.`);
    }
  } finally {
    await db.$disconnect();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The demo seed failed.');
  process.exitCode = 1;
}
