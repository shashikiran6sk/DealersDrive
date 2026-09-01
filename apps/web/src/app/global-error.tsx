'use client';

import { useEffect } from 'react';

import '@/styles/globals.css';

/**
 * The last resort: the only boundary that catches a throw in the *root* layout.
 *
 * It replaces the whole document when it renders, which is why it ships its own
 * `<html>` and `<body>` — and why it leans on almost nothing. If `layout.tsx`
 * itself failed, assuming the shell it renders would be assuming the thing that
 * just broke, so the styling here is deliberately minimal and self-contained.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col justify-center px-6 text-center">
          <h1 className="font-heading text-[22px] font-semibold">Dealers-Drive is not loading</h1>
          <p className="mx-auto mt-[7px] max-w-[46ch] text-[14px] ink-muted">
            Something went wrong on our side. Please try again in a moment.
          </p>
          <div className="mt-[18px] flex justify-center">
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
