import { ButtonLink } from '@/components/ui/button';
import { vehicleHref } from '@/components/vehicle/vehicle-card';

import { LIFECYCLE_TEXT } from './listing-lifecycle.constants';
import { ListingLifecycleActions } from './listing-lifecycle-actions';
import type { ListingLifecyclePanelProps } from './listing-lifecycle.types';

export function ListingLifecyclePanel({
  vehicleId,
  vehicleTitle,
  listing,
}: ListingLifecyclePanelProps) {
  const liveSlug = listing.status === 'ACTIVE' ? listing.slug : null;
  const reactivationPending = listing.reactivation?.status === 'PENDING';
  const declined = listing.reactivation?.status === 'REJECTED' ? listing.reactivation : null;
  if (listing.actions.length === 0 && !liveSlug && !reactivationPending) return null;

  return (
    <section
      aria-label={LIFECYCLE_TEXT.listingHeading}
      className="flex flex-col gap-[10px] border-t border-(--color-divider) pt-[16px]"
    >
      {listing.withdrawal || declined ? (
        <dl className="m-0 flex flex-col gap-[4px] text-[13px]">
          {listing.withdrawal ? (
            <div className="flex flex-wrap gap-[6px]">
              <dt className="ink-subtle">{LIFECYCLE_TEXT.withdrawnReason}</dt>
              <dd className="m-0">{listing.withdrawal.reasonLabel}</dd>
            </div>
          ) : null}
          {listing.withdrawal?.note ? (
            <div className="flex flex-wrap gap-[6px]">
              <dt className="ink-subtle">{LIFECYCLE_TEXT.withdrawnNote}</dt>
              <dd className="m-0">{listing.withdrawal.note}</dd>
            </div>
          ) : null}
          {declined ? (
            <div className="flex flex-wrap gap-[6px]">
              <dt className="ink-subtle">{LIFECYCLE_TEXT.reactivationDeclined}</dt>
              <dd className="m-0">{declined.adminNote ?? LIFECYCLE_TEXT.reactivationNoNote}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <div className="flex flex-wrap items-center gap-[9px]">
        <ListingLifecycleActions
          vehicleId={vehicleId}
          vehicleTitle={vehicleTitle}
          actions={listing.actions}
          reactivationPending={reactivationPending}
        />
        {liveSlug ? (
          <ButtonLink href={vehicleHref(liveSlug)} variant="ghost" className="ml-auto">
            {LIFECYCLE_TEXT.viewOnSite}
          </ButtonLink>
        ) : null}
      </div>
    </section>
  );
}
