import { defineConfig } from 'vitest/config';
import { TEST_URL } from './src/test/integration-env.ts';
import thresholds from './tooling/coverage-thresholds.json' with { type: 'json' };

export default defineConfig({
  test: {
    server: { deps: { inline: ['next-intl'] } },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['**/node_modules/**', 'docs/old-source-code/**', 'src/**/*.int.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int.test.ts'],
          globalSetup: ['src/test/integration-setup.ts'],
          env: { DATABASE_URL: TEST_URL, DATABASE_URL_UNPOOLED: TEST_URL },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/server/**', 'src/lib/**'],
      thresholds,
    },
  },
});
