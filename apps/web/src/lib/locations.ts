import { PublicLocations } from '@dealers-drive/contracts';

import { apiGetParsed } from '@/lib/api';
import { DEALERS_TAG } from '@/lib/cache-tags';

/**
 * The districts the platform trades in — A12, `GET /v1/locations`.
 *
 * ## Why it is a helper rather than two fetches (R23)
 *
 * The public layout has always read this for the header's button. R23 gives the
 * directory a second reason to want it: with no district chosen it draws a
 * `Select district` button instead of a row of every town on the platform, and
 * that button opens the same dialog off the same list.
 *
 * Two callers is where the fetch *options* start to matter. `revalidate` and
 * the cache tag are not incidental — they are what makes the second read a
 * cache hit rather than a second round trip to the API, and what makes both
 * callers agree about how stale the list may be. Written twice they would
 * eventually differ by a digit, and the symptom would be a header and a page
 * disagreeing about which districts exist.
 *
 * ## Why it is parsed rather than cast (R22)
 *
 * `apiGet<PublicLocations>` is an assertion, and this is the one read in the
 * product where an assertion that turns out to be false renders as a **sentence
 * a buyer believes** rather than as an obvious break.
 *
 * It happened. R22 added `state` to each district; for the ten minutes between
 * the API restarting and the fetch cache expiring, the header was handed the
 * previous payload, `state` was `undefined`, and the selector filed every
 * district in the country under "State not recorded" — the product asserting,
 * in its own voice, that it did not know which state Chennai is in.
 *
 * `apiGetParsed` makes that a throw, and `getPublicLocations` turns the throw
 * into an empty list. An empty selector for the length of a skewed deploy is a
 * cost worth paying; a false statement for the same minutes is not.
 *
 * ## The cache is why the skew outlives the deploy
 *
 * `revalidate: 600` means a payload fetched before a deploy can be served for
 * ten minutes after it. `DEALERS_TAG` clears it when a dealership changes, and
 * a dealership does not change because the API was rebuilt — so this window is
 * real, expected, and exactly when the parse earns its place.
 */
export const NO_LOCATIONS: PublicLocations = { districts: [], total: 0 };

/**
 * The list, or an empty one.
 *
 * It never throws, and that is the point: this is read from a **layout**, and a
 * throw in a layout escapes every error boundary below the root to land on
 * `global-error.tsx`, which replaces the whole document. Losing one dropdown is
 * not worth losing the page under it.
 */
export async function getPublicLocations(): Promise<PublicLocations> {
  return apiGetParsed(PublicLocations, '/v1/locations', {
    revalidate: 600,
    // Tagged, so approving or suspending a dealership moves the header's counts
    // at once rather than within ten minutes (`lib/cache-tags.ts`).
    tags: [DEALERS_TAG],
  }).catch((error: unknown) => {
    // Named rather than swallowed: an empty header and a skewed deploy look
    // identical from the outside, and only one of them is worth waking up for.
    console.error('[locations] unavailable', error);
    return NO_LOCATIONS;
  });
}
