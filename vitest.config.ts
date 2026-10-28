import { defineConfig } from 'vitest/config';
import thresholds from './tooling/coverage-thresholds.json' with { type: 'json' };

export default defineConfig({
  test: {
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
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/server/**', 'src/lib/**'],
      thresholds,
    },
  },
});
