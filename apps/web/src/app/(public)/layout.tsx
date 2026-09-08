import { PublicLocations } from '@dealers-drive/contracts';
import type { ReactNode } from 'react';

import { CustomerFooter } from '@/components/layout/customer-footer';
import { CustomerHeader } from '@/components/layout/customer-header';
import { apiGetParsed } from '@/lib/api';
import { DEALERS_TAG } from '@/lib/cache-tags';

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
 * ## Why it is parsed rather than cast (R22)
 *
 * `apiGet<PublicLocations>` is an assertion, and this is the one read in the
 * product where an assertion that turns out to be false renders as a **sentence
 * a buyer believes** rather than as an obvious break.
 *
 * It happened. R22 added `state` to each district; for the ten minutes between
 * the API restarting and the fetch cache below expiring, the header was handed
 * the previous payload, `state` was `undefined`, and the selector filed every
 * district in the country under "State not recorded" — the product asserting,
 * in its own voice, that it did not know which state Chennai is in.
 *
 * `apiGetParsed` makes that a throw, and the throw lands in the same `.catch`
 * an unreachable API already lands in. An empty selector for the length of a
 * skewed deploy is a cost worth paying; a false statement for the same minutes
 * is not.
 *
 * ## The cache is why the skew outlives the deploy
 *
 * `revalidate: 600` means a payload fetched before a deploy can be served for
 * ten minutes after it. `DEALERS_TAG` clears it when a dealership changes, and
 * a dealership does not change because the API was rebuilt — so this window is
 * real, expected, and exactly when the parse earns its place.
 *
 * `SavedCarsProvider` wraps this tree from **F087**.
 */
const NO_LOCATIONS: PublicLocations = { districts: [], total: 0 };

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const locations = await apiGetParsed(PublicLocations, '/v1/locations', {
    revalidate: 600,
    // Tagged, so approving or suspending a dealership moves the header's counts
    // at once rather than within ten minutes (`lib/cache-tags.ts`).
    tags: [DEALERS_TAG],
  }).catch((error: unknown) => {
    // Named rather than swallowed: an empty header and a skewed deploy look
    // identical from the outside, and only one of them is worth waking up for.
    console.error('[public layout] locations unavailable', error);
    return NO_LOCATIONS;
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeader locations={locations} />
      <main className="flex-1">{children}</main>
      <CustomerFooter />
    </div>
  );
}
