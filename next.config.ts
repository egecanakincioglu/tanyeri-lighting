import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { blobHostname } from './src/lib/blob-hostname.ts';

const securityHeaders: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // The proxy CSP covers pages; this covers paths the proxy skips, such as 404s of files.
  'X-Frame-Options': 'DENY',
};

// Not 'immutable': static files keep their address when replaced.
const staticFileHeaders: Record<string, string> = {
  'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
};

const toEntries = (headers: Record<string, string>) => Object.entries(headers).map(([key, value]) => ({ key, value }));

// Only this installation's store may be optimized, or another store could use our quota. No token means no uploads.
const blobHost = blobHostname(process.env.BLOB_READ_WRITE_TOKEN);

const nextConfig: NextConfig = {
  // Makes the head wait for streamed metadata, which crawlers and Lighthouse do not find in <body>.
  htmlLimitedBots: /.*/,
  images: {
    imageSizes: [32, 48, 64, 96, 128, 192, 256, 384, 512],
    deviceSizes: [640, 680, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
    qualities: [60],
    // 31 days. A replaced demo photo keeps its address, so it shows after the cache entry expires.
    minimumCacheTTL: 2678400,
    // Served through our own image optimizer, so CSP img-src 'self' already covers it.
    remotePatterns: blobHost ? [{ protocol: 'https', hostname: blobHost, search: '' }] : [],
  },
  poweredByHeader: false,
  headers: async () => [
    { source: '/:path*', headers: toEntries(securityHeaders) },
    ...['/brand', '/icons', '/demo'].map((dir) => ({
      source: dir + '/:path*',
      headers: toEntries(staticFileHeaders),
    })),
  ],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
