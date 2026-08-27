'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/primitives';

/**
 * The boundary above every route group.
 *
 * A `error.tsx` catches throws from the segment *below* it, never from its own
 * layout — so the segment boundaries in `(public)`, `(dealer)` and `(admin)`
 * cannot catch a failure in `(public)/layout.tsx`, which is exactly where the
 * catalogue's `/v1/cities` fetch lives. This file is that group's parent, so
 * it is the one that catches it. Without it Next falls back to its own error
 * screen: the red overlay in development, and a bare "Application error: a
 * server-side exception has occurred" in production.
 *
 * Nothing from `error` reaches the page. A thrown `ApiError` stringifies to
 * the API's `detail`, which outside production is the bug's own words; and a
 * `fetch failed` means the API is down, which is true but not the reader's
 * problem. `digest` is the handle: it is in the server log next to the stack.
 */
export default function AppError({
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
    <div className="mx-auto max-w-[720px] px-6 py-20">
      <ErrorState
        title="This page could not be loaded"
        message="Something went wrong on our side, not yours. Try again in a moment — if it keeps happening, the problem is already in our logs."
        action={
          <>
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/" className="btn btn-secondary">
              Go to the homepage
            </Link>
          </>
        }
      />
    </div>
  );
}
