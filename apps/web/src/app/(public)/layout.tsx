import type { ReactNode } from 'react';

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { getPublicLocations } from '@/lib/locations';

/**
 * The buyer shell. No authentication anywhere below this layout, and no
 * sign-in gate on the catalogue, a vehicle page, a portfolio or an enquiry
 * form (DESIGN-SPEC §4.10).
 *
 * The one thing it fetches is the header's location list. It replaces the
 * baseline's `GET /v1/cities` — **D6** withdrew that endpoint with the `cities`
 * table — and answers a better question besides: the districts dealerships are
 * actually in, counted, rather than the five towns somebody seeded.
 *
 * The fetch, why it is parsed rather than cast, and why it degrades to an empty
 * list rather than throwing, all moved to `lib/locations.ts` at **R23**, when
 * the directory became a second caller. The reasoning is there in full.
 *
 * `SavedCarsProvider` wraps this tree from **F087**.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const locations = await getPublicLocations();

  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader locations={locations} />
      <main className="flex-1">{children}</main>
      <CustomerFooter />
    </div>
  );
}
