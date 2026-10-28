import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const securityHeaders: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

const nextConfig: NextConfig = {
  headers: async () => [
    { source: '/:path*', headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })) },
  ],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
