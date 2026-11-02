// @vitest-environment node
import { describe, expect, it } from 'vitest';
import nextConfig from '../next.config.ts';

describe('next.config headers', () => {
  it('sets the static security headers on every path', async () => {
    const rules = await nextConfig.headers?.();
    expect(rules?.[0]?.source).toBe('/:path*');
    expect(Object.fromEntries(rules?.[0]?.headers.map(({ key, value }) => [key, value]) ?? [])).toEqual({
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin',
    });
  });

  it('caches the static file folders for a day without marking them immutable', async () => {
    const rules = (await nextConfig.headers?.())?.slice(1) ?? [];
    expect(rules.map((rule) => rule.source)).toEqual(['/brand/:path*', '/icons/:path*', '/demo/:path*']);
    for (const rule of rules) {
      expect(rule.headers).toEqual([
        { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
      ]);
    }
  });
});

describe('next.config images', () => {
  it('keeps optimized pictures for 31 days', () => {
    expect(nextConfig.images?.minimumCacheTTL).toBe(31 * 24 * 60 * 60);
  });

  it('allows only the one photo quality the components request', () => {
    expect(nextConfig.images?.qualities).toEqual([60]);
  });
});
