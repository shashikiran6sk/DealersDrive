import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AUTH_HINT_SCRIPT } from '@/lib/auth-hint';
import { serverConfig } from '@/lib/config';
import { manrope } from '@/lib/fonts';
import { rootMetadata } from '@/lib/seo';
import '@/styles/globals.css';

export function generateMetadata(): Metadata {
  return rootMetadata();
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = serverConfig();

  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <body className="min-h-dvh">
        <script dangerouslySetInnerHTML={{ __html: AUTH_HINT_SCRIPT }} />
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
