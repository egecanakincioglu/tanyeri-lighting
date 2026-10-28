import { defineConfig } from 'vitest/config';
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
          exclude: ['**/node_modules/**', 'docs/old-source-code/**'],
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
