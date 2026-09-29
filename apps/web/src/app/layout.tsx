import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import type { ReactNode } from 'react';

import { serverConfig } from '@/lib/config';
import '@/styles/globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-manrope',
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
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = serverConfig();

  return (
    <html lang="en" className={manrope.variable}>
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
