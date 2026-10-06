'use client';

import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { ErrorState } from '@/components/ui/primitives';

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <div className="mx-auto max-w-[720px] px-6 py-20">
      <ErrorState
        title="This page could not be loaded"
        message="Something went wrong on our side. Nothing you entered was submitted by this — the dealership is where you left it."
        action={
          <>
            <button type="button" onClick={reset} className="btn btn-primary">
              Try again
            </button>
            <Link href="/sales" className="relative btn btn-secondary">
              <LinkPendingLabel>Back to the dashboard</LinkPendingLabel>
            </Link>
          </>
        }
      />
    </div>
  );
}
