'use client';

import type { AdminListingDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/primitives';
import { changeListingAvailabilityAction } from '@/features/admin/listing-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

export function AvailabilityPanel({ detail }: { detail: AdminListingDetail }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [action, setAction] = useState<'reserve' | 'mark-sold' | null>(null);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useNavigationSafeAction();
  if (!detail.actions.canReserve && !detail.actions.canMarkSold) return null;
  const sold = action === 'mark-sold';
  const title = sold ? 'Mark vehicle sold' : 'Reserve vehicle';
  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const result = await changeListingAvailabilityAction(detail.listing.id, action);
      if (result.ok) {
        setAction(null);
        setMessage(undefined);
        router.refresh();
      } else setMessage(result.message);
    });
  }
  return (
    <section className="card gap-3 bg-white p-4" aria-labelledby="availability-heading">
      <h2 id="availability-heading" className="text-[16px]">
        Availability
      </h2>
      <div className="flex flex-wrap gap-2">
        {detail.actions.canReserve ? (
          <Button
            variant="secondary"
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setMessage(undefined);
              setAction('reserve');
            }}
          >
            Mark reserved
          </Button>
        ) : null}
        {detail.actions.canMarkSold ? (
          <Button
            variant="secondary"
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setMessage(undefined);
              setAction('mark-sold');
            }}
          >
            Mark sold
          </Button>
        ) : null}
      </div>
      <Dialog
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          triggerRef.current?.focus();
        }}
        open={action !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setAction(null);
        }}
        title={title}
        description={
          sold
            ? 'This marks the vehicle sold and releases its registration. This action cannot be undone.'
            : 'This reserves the vehicle for a buyer. Putting it back on sale requires the existing reactivation process.'
        }
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} onClick={confirm}>
              {sold ? 'Confirm sold' : 'Confirm reservation'}
            </Button>
          </>
        }
      >
        {message ? <Banner tone="err">{message}</Banner> : null}
      </Dialog>
    </section>
  );
}
