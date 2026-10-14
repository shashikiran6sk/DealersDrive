import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    icons: [
      { src: '/brand/dd-icon-v2-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/dd-icon-v2-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/brand/dd-icon-v2-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
