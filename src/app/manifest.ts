import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tanyeri Lighting',
    short_name: 'Tanyeri',
    start_url: '/tr',
    display: 'standalone',
    background_color: '#f5f5f5',
    theme_color: '#e8730a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
