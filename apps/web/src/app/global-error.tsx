'use client';

import { RouteError } from '@/components/errors/route-error';
import { StatusShell } from '@/components/errors/status-shell';
import { manrope } from '@/lib/fonts';
import '@/styles/globals.css';

export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="min-h-dvh">
        <StatusShell>
          <RouteError {...props} />
        </StatusShell>
      </body>
    </html>
  );
}
