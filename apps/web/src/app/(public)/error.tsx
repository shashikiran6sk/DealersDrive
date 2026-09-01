'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/primitives';

/**
 * The buyer-facing boundary. Sits inside `(public)/layout.tsx`, so the header,
 * the city switcher and the footer all survive the failure and the reader is
 * still somewhere rather than nowhere.
 *
 * The copy names no system and offers no reference code. A buyer browsing used
 * cars cannot act on "listing_search does not exist" and should never be shown
 * a page that looks like it broke *at* them; the two links are the only useful
 * things on the screen.
 */
export default function PublicError({
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
        title="We could not load this just now"
        message="This is a problem on our side, and it is usually brief. Try again, or carry on browsing — the rest of the market is still here."
        action={
          <>
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/cars" className="btn btn-secondary">
              Browse used cars
            </Link>
          </>
        }
      />
    </div>
  );
}
