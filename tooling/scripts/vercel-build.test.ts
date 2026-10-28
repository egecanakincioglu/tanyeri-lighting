// Tests for vercel-build.ts: the decision logic only; the real prisma and next are never run.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { plan } from './vercel-build.ts';

const URL = 'postgresql://postgres@localhost:5432/tanyeri';

describe('plan', () => {
  test('preview generates, migrates, then builds', () =>
    assert.deepEqual(plan({ VERCEL_ENV: 'preview', DATABASE_URL_UNPOOLED: URL }), {
      steps: ['generate', 'migrate', 'build'],
    }));
  test('production generates, migrates, then builds', () =>
    assert.deepEqual(plan({ VERCEL_ENV: 'production', DATABASE_URL_UNPOOLED: URL }), {
      steps: ['generate', 'migrate', 'build'],
    }));
  test('production without the unpooled URL is an error', () => {
    const result = plan({ VERCEL_ENV: 'production' });
    assert.deepEqual(result.steps, []);
    assert.match(result.error ?? '', /DATABASE_URL_UNPOOLED/);
  });
  test('development generates and builds', () => {
    const result = plan({ VERCEL_ENV: 'development' });
    assert.deepEqual(result.steps, ['generate', 'build']);
    assert.match(result.info ?? '', /not applied outside preview and production/);
  });
  test('an undefined environment generates and builds', () => assert.deepEqual(plan({}).steps, ['generate', 'build']));
  test('preview without the unpooled URL is an error', () => {
    const result = plan({ VERCEL_ENV: 'preview' });
    assert.deepEqual(result.steps, []);
    assert.match(result.error ?? '', /DATABASE_URL_UNPOOLED/);
  });
  test('preview with an empty unpooled URL is an error', () =>
    assert.ok(plan({ VERCEL_ENV: 'preview', DATABASE_URL_UNPOOLED: '' }).error));
});
