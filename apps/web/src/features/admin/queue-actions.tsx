'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { approveListingAction } from '@/features/admin/actions';

/**
 * DESIGN-SPEC §4.7 allows a `btn-primary` inside a table row here and nowhere
 * else: approving is the moderation queue's entire purpose, and making a
 * reviewer open a detail page for the obvious cases is how a queue backs up.
 */
export function QueueApproveButton({
  listingId,
  title,
}: {
  listingId: string;
  title: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        loading={pending}
        aria-label={`Approve ${title}`}
        onClick={() =>
          startTransition(async () => {
            const result = await approveListingAction(listingId);
            if (!result.ok) {
              setError(result.message ?? 'We could not approve that listing.');
              return;
            }
            setError(null);
            router.refresh();
          })
        }
      >
        Approve
      </Button>

      {error ? (
        <Banner tone="err" className="mt-2 text-left">
          {error}
        </Banner>
      ) : null}
    </>
  );
}
