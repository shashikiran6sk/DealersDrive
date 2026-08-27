'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/primitives';

/**
 * The console boundary.
 *
 * A dealer is a named user with a support channel, so this one shows the
 * `digest` — the same value Next logs beside the stack, which turns "it broke"
 * into a line support can search. It is an opaque hash, not the error text:
 * naming our internals to a tenant is what this boundary exists to prevent.
 */
export default function DealerError({
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
        message="Something went wrong on our side. Your inventory and your enquiries are unaffected — nothing was saved or changed by this."
        action={
          <>
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/dealer" className="btn btn-secondary">
              Back to the dashboard
            </Link>
          </>
        }
      />
      {error.digest ? (
        <p className="mt-4 text-center text-[12px] ink-muted">
          Reference <span className="font-mono">{error.digest}</span> — quote this if you contact
          support.
        </p>
      ) : null}
    </div>
  );
}
