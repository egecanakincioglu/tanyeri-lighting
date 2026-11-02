import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const securityHeaders: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Static files keep their address when replaced, so no 'immutable': a day fresh, then a week of quiet revalidation.
const staticFileCache = 'public, max-age=86400, stale-while-revalidate=604800';

const nextConfig: NextConfig = {
  images: {
    imageSizes: [32, 48, 64, 96, 128, 192, 256, 384, 512],
    deviceSizes: [640, 680, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
    qualities: [60],
    // 31 days. Uploaded pictures get a new address when replaced; a replaced demo photo keeps its address, so it shows
    // once the optimizer entry has expired.
    minimumCacheTTL: 2678400,
    // Uploaded pictures live in the public Vercel Blob store. They are served through the image optimizer from our own
    // origin, so the CSP img-src 'self' already covers them.
    remotePatterns: [{ protocol: 'https', hostname: '*.public.blob.vercel-storage.com' }],
  },
  // The panel uploads files of up to 4 MB (MAX_UPLOAD_BYTES) through a Server Action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  headers: async () => [
    { source: '/:path*', headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })) },
    ...['/brand', '/icons', '/demo'].map((dir) => ({
      source: dir + '/:path*',
      headers: [{ key: 'Cache-Control', value: staticFileCache }],
    })),
  ],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
