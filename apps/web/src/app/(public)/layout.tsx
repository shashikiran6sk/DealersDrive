import type { PublicLocations } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { apiGet } from '@/lib/api';

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
 * ## Why the `.catch`
 *
 * A throw in a layout escapes every error boundary below the root and lands on
 * `global-error.tsx`, which replaces the whole document. Losing one dropdown is
 * not worth losing the page under it, so an unreachable API degrades to a
 * selector with nothing in it and every other route below still renders.
 *
 * `SavedCarsProvider` wraps this tree from **F087**.
 */
const NO_LOCATIONS: PublicLocations = { districts: [], total: 0 };

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const locations = await apiGet<PublicLocations>('/v1/locations', { revalidate: 600 }).catch(
    () => NO_LOCATIONS,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader locations={locations} />
      <main className="flex-1">{children}</main>
      <CustomerFooter />
    </div>
  );
}
