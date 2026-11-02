import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';
import { blobHostname } from './src/lib/blob-hostname.ts';

const securityHeaders: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// Only the store of this installation may be optimized; another store would spend its quota and serve foreign pictures
// from our origin. Without a token there are no uploads, so there is no remote host either.
const blobHost = blobHostname(process.env.BLOB_READ_WRITE_TOKEN);

const nextConfig: NextConfig = {
  images: {
    imageSizes: [32, 48, 64, 96, 128, 192, 256, 384, 512],
    deviceSizes: [640, 680, 750, 828, 1080, 1200, 1440, 1920, 2048, 3840],
    qualities: [60],
    // Uploaded pictures live in the public Vercel Blob store. They are served through the image optimizer from our own
    // origin, so the CSP img-src 'self' already covers them.
    remotePatterns: blobHost ? [{ protocol: 'https', hostname: blobHost, search: '' }] : [],
  },
  // The panel uploads files of up to 4 MB (MAX_UPLOAD_BYTES) through a Server Action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '5mb' } },
  headers: async () => [
    { source: '/:path*', headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })) },
  ],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
