import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { serverConfig } from '@/lib/config';
import '@/styles/globals.css';

/**
 * Inter is self-hosted through `next/font`; Cabinet Grotesk comes from
 * Fontshare with Inter as its declared fallback (DESIGN-SPEC §1.3), so the
 * app degrades to the specified fallback rather than to a system serif when
 * that request fails.
 */
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Dealers-Drive — used cars from verified independent dealers',
    template: '%s · Dealers-Drive',
  },
  description:
    'Every vehicle on Dealers-Drive is owned, priced and maintained by a verified independent dealer near you.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f4f5f7',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Read at runtime, in a server component, and passed down — never inlined
  // into the bundle as a NEXT_PUBLIC_* variable (ARCHITECTURE §15.3).
  const config = serverConfig();

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f%5B%5D=cabinet-grotesk@600,700,800&display=swap"
        />
      </head>
      <body className="min-h-dvh">
        {config.appEnv !== 'production' ? (
          <div className="bg-(--color-warn-bg) px-6 py-[6px] text-center text-[11px] uppercase tracking-[0.1em] text-(--color-warn)">
            {config.appEnv} — not real data
          </div>
        ) : null}
        {children}
      </body>
    </html>
  );
}
