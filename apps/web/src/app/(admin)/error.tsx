'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { ErrorState } from '@/components/ui/primitives';

export default function AdminError({
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
        message="Something went wrong on our side. No moderation decision was recorded by this — whatever you were reviewing is still in the queue."
        action={
          <>
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/admin" className="btn btn-secondary">
              Back to the queue
            </Link>
          </>
        }
      />
      {error.digest ? (
        <p className="mt-4 text-center text-[12px] ink-muted">
          Reference <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </div>
  );
}
