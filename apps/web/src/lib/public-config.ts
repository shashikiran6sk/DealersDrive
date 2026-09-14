import { PublicConfig } from '@dealers-drive/contracts';

import { apiGetParsed } from '@/lib/api';
import { CONFIG_TAG } from '@/lib/cache-tags';

/**
 * The public bootstrap payload — A14, `GET /v1/config/public` (**R44**).
 *
 * ## Why the web app reads this at all
 *
 * Everything on it could have been an environment variable, and every one of
 * them would then have been a `NEXT_PUBLIC_*` baked into the image at build
 * time — which is exactly what Rule 9 and ARCHITECTURE §15.3 forbid, because it
 * makes one image per environment and ends build-once-promote-many. Support
 * contacts and the social links move on a marketing timescale rather than a
 * release one; reading them at request time is what lets an operator correct a
 * dead link from `/admin/config` and see it on the next page load.
 *
 * ## Why it is parsed rather than cast
 *
 * The same reason `getPublicLocations` is. `apiGet<PublicConfig>` is an
 * assertion, and a false one here renders as an `href` — a link a buyer clicks
 * that goes somewhere unintended reads as the product's own recommendation.
 * `apiGetParsed` makes a skewed payload a throw instead.
 *
 * ## Why it never throws
 *
 * It is read from a **layout**, and a throw in a layout escapes every error
 * boundary below the root to land on `global-error.tsx`, which replaces the
 * whole document. Losing the footer's contact row is not worth losing the page
 * above it, so an unreachable API degrades to `NO_PUBLIC_CONFIG` — support
 * contacts absent, no social icons, and a footer that still renders its links
 * and its trust line.
 */
export const NO_PUBLIC_CONFIG: PublicConfig = {
  mediaBaseUrl: '',
  captchaSiteKey: null,
  supportEmail: '',
  supportPhone: '',
  minPhotosPerListing: 0,
  listingDurationDays: 0,
  enquiryRateLimitPerHour: 0,
  photoRequestsEnabled: false,
  rcLookupEnabled: false,
  vehicleReportEnabled: false,
  social: [],
};

export async function getPublicConfig(): Promise<PublicConfig> {
  return apiGetParsed(PublicConfig, '/v1/config/public', {
    // Ten minutes, like the rest of the public shell — but the tag is what
    // actually governs it: `revalidatePublicConfig()` clears this the moment an
    // admin saves a key, so the window only ever applies to a value nobody has
    // touched.
    revalidate: 600,
    tags: [CONFIG_TAG],
  }).catch((error: unknown) => {
    // Named rather than swallowed: an empty footer and an unreachable API look
    // identical from the outside, and only one of them is worth waking up for.
    console.error('[public-config] unavailable', error);
    return NO_PUBLIC_CONFIG;
  });
}
