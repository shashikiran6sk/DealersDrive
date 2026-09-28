'use client';

import { listingLifecycleAction } from '@/features/dealer/listing-lifecycle/actions';

import { LifecycleDialog } from './lifecycle-dialog';
import { LIFECYCLE_TEXT } from './listing-lifecycle.constants';
import type { ListingLifecycleActionsProps } from './listing-lifecycle.types';

export function ListingLifecycleActions({
  vehicleId,
  vehicleTitle,
  actions,
  size = 'default',
  submit = listingLifecycleAction,
}: ListingLifecycleActionsProps) {
  if (actions.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={LIFECYCLE_TEXT.groupLabel(vehicleTitle)}
      className="flex flex-wrap items-center gap-[6px]"
    >
      {actions.map((action) => (
        <LifecycleDialog
          key={action}
          vehicleId={vehicleId}
          action={action}
          size={size}
          submit={submit}
        />
      ))}
    </div>
  );
}
