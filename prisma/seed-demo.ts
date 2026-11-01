// Fills the site content with the fictional demo content: `pnpm db:seed:demo`, after `pnpm db:seed`.
// It refuses when site content already exists, unless run with --replace or with DEMO_MODE=true; then the content is
// replaced and a second run leaves the same content. Users are not touched.
import { getDb } from '../src/server/db.ts';
import { isDemoMode } from '../src/server/env.ts';
import { seedDemoContent } from './demo-content.ts';

try {
  const db = getDb();
  try {
    const counts = await seedDemoContent(db, { replace: process.argv.includes('--replace') || isDemoMode() });
    console.log(
      `Seeded the demo content: ${counts.products} products in ${counts.categories} categories, ${counts.projects} projects.`,
    );
  } finally {
    await db.$disconnect();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The demo seed failed.');
  process.exitCode = 1;
}
