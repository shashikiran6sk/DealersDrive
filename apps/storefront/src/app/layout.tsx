import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@dealers-drive/storefront-ui/styles.css';
import './globals.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
