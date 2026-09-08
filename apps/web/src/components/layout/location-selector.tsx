'use client';

import type { PublicLocations } from '@dealers-drive/contracts';

import { DistrictPicker } from '@/components/layout/district-picker';

/**
 * DESIGN-SPEC §2.14 — the header's location button.
 *
 * The dialog it opens, and the rule for what choosing a district means, are
 * `DistrictPicker`'s (**R23**) — the directory opens the same dialog from its
 * own button, and a second copy of the selection rule is how the two would come
 * to disagree. What is left here is the header's trigger and nothing else.
 *
 * ## "Select district", not "All districts" (R23)
 *
 * The button used to read `All districts` before a choice was made, which is a
 * true description of what is on screen and a poor description of what the
 * button is *for*. It states a filter setting where a first-time visitor needs
 * an invitation, and it is the only control in the header that offers to narrow
 * the platform to somewhere near them.
 *
 * `All districts` is not gone — it is the dialog's footer button, where it is
 * the way *back* rather than the resting state, and it still carries its count.
 * Nothing about the unfiltered URL changed: `/dealers` with no `?district=` is
 * still every dealership, still what the directory shows on arrival, and still
 * the one dealers URL `indexPolicy` marks indexable.
 */
export function LocationSelector({ locations }: { locations: PublicLocations }) {
  return (
    <DistrictPicker locations={locations}>
      {(chosen) => (
        <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
          <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
          {chosen?.name ?? 'Select district'} <span aria-hidden="true">▾</span>
        </button>
      )}
    </DistrictPicker>
  );
}
