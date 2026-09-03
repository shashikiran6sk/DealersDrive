import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

/**
 * The root layout, reduced to what cannot be deferred: the font variable, the
 * document shell and the stylesheet import. The environment banner, the
 * Fontshare preconnect and `serverConfig()` return with the features that own
 * them (F029 for runtime config, F007 for the type system).
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
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
