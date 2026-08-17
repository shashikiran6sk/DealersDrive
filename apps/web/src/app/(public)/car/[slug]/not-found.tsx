import Link from 'next/link';

import { EmptyState } from '@/components/ui/primitives';

/**
 * A5 404s for three different reasons — not approved, dealer not active, or
 * deleted — and a buyer needs none of them. All three mean the same thing on
 * screen: the car has gone, here is the rest of the market.
 */
export default function CarNotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-20">
      <EmptyState
        title="This car is no longer listed"
        message="It has been sold, withdrawn by the dealer, or the listing has expired. There are plenty of others."
        action={
          <>
            <Link href="/cars" className="btn btn-primary">
              Browse used cars
            </Link>
            <Link href="/dealers" className="btn btn-secondary">
              Find a dealer
            </Link>
          </>
        }
      />
    </div>
  );
}
