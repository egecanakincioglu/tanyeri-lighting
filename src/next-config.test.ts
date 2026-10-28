// @vitest-environment node
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config.ts';

describe('next.config headers', () => {
  it('sets the static security headers on every path', async () => {
    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.source).toBe('/:path*');
    expect(Object.fromEntries(rules?.[0]?.headers.map(({ key, value }) => [key, value]) ?? [])).toEqual({
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
  });
});
