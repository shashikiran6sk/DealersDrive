import { z } from 'zod';

/**
 * PART A — the public API (API-SPEC A1–A15). No authentication anywhere in
 * this file, and no dealer phone number in any response shape: the only route
 * that returns one is A7, and it is deliberately a POST.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline file is ~700 lines and describes the whole public surface —
 * search, facets, the home page, vehicle detail, the dealer directory. Each
 * shape arrives with the feature that first answers with it, so this file grows
 * rather than landing whole. `PublicConfig` is here because **F029** serves it
 * from `GET /v1/config/public`.
 *
 * `CitiesResponse` (A12) was here too, for F026's `GET /v1/cities`. It is gone
 * with the `cities` table — see the locality note in `dealer.ts`. Search will
 * offer the cities dealers actually trade in, counted from `listing_search` at
 * **F076**, rather than the five somebody typed into a seed file.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ─────────── A14 public config ─────────────────────────────────────────────
export const PublicConfig = z.object({
  mediaBaseUrl: z.string(),
  captchaSiteKey: z.string().nullable(),
  supportEmail: z.string(),
  supportPhone: z.string(),
  minPhotosPerListing: z.number().int(),
  listingDurationDays: z.number().int(),
  enquiryRateLimitPerHour: z.number().int(),
  photoRequestsEnabled: z.boolean(),
  /**
   * Whether "Add a vehicle" opens on the number-plate field or on today's
   * seven-dropdown Basics form. Both are complete flows, which is what makes
   * this a safe rollback rather than a half-disabled feature.
   */
  rcLookupEnabled: z.boolean(),
  /** Whether listing pages carry a records check at all. */
  vehicleReportEnabled: z.boolean(),
});
export type PublicConfig = z.infer<typeof PublicConfig>;
