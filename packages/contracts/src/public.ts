import { OffsetPage } from './common.js';
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

// ─────────── A8–A9 the dealer directory ────────────────────────────────────
/**
 * A8 query grammar. `.strict()`, like every other input in this package: a
 * `/v1/dealers?town=vellore` is a 400 naming `town`, not a silently unfiltered
 * page of every dealership on the platform.
 */
export const DealerDirectoryQuery = z
  .object({
    /**
     * A city **slug**, not a city id.
     *
     * ── Deliberate divergence from the baseline ─────────────────────────────
     * It used to be the `slug` column of a `cities` row. **D6** removed that
     * table, so the slug is now derived from the name the dealership itself
     * carries — `slugify(dealer.city)` — and matched the same way on the way
     * back in. The chip links keep the shape they had, and there is no second
     * copy of the name/slug pair that can fall out of step with the first,
     * which is what the column was for.
     * ────────────────────────────────────────────────────────────────────────
     */
    city: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    q: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).max(40).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();
export type DealerDirectoryQuery = z.infer<typeof DealerDirectoryQuery>;

/**
 * One dealership as the directory grid shows it.
 *
 * Every display string is composed on the server — `yearsLabel`,
 * `fromPriceLabel` — for the same reason the vehicle card's are: they are the
 * product's own voice, and "from ₹4.2 L" versus "₹4,20,000 onwards" should not
 * be a decision each component author takes again.
 *
 * There is **no phone number here, and no email**. The only route that returns
 * a dealer's number is `POST /v1/vehicles/:id/reveal-contact`, and it is
 * deliberately a POST so it can be rate-limited and logged as a lead
 * (CLAUDE.md rule 7).
 */
export const DealerCard = z.object({
  slug: z.string(),
  brandName: z.string(),
  initials: z.string(),
  city: z.string(),
  state: z.string(),
  yearsOperating: z.number().int(),
  /** Already reads "Vellore, Tamil Nadu · 7 years" — one line, composed once. */
  yearsLabel: z.string(),
  tagline: z.string().nullable(),
  services: z.array(z.string()),
  carCount: z.number().int(),
  fromPricePaise: z.number().int().nullable(),
  /** An em dash when the dealership has no live cars — never "from ₹0". */
  fromPriceLabel: z.string(),
  isVerified: z.boolean(),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
});
export type DealerCard = z.infer<typeof DealerCard>;

export const DealerDirectoryResponse = z.object({
  data: z.array(DealerCard),
  page: OffsetPage,
  countLabel: z.string(),
  /** The chips. Only cities that hold at least one verified dealership. */
  cities: z.array(z.object({ slug: z.string(), name: z.string(), count: z.number().int() })),
});
export type DealerDirectoryResponse = z.infer<typeof DealerDirectoryResponse>;

/**
 * A9 — one dealership's public page, as a buyer sees it.
 *
 * ## This shape is a privacy boundary
 *
 * `contact` is a list of rows the page renders verbatim, and the phone row
 * carries `masked: true` and the words "Tap to reveal" — **not a number**.
 * That is not a rendering convention a component could forget: there is no
 * field in this schema that could hold one.
 *
 * GSTIN is here and PAN is not, and the difference is not squeamishness: a
 * GSTIN is printed on every invoice an Indian business issues and is a thing a
 * buyer can check, while a PAN is the proprietor's tax identity.
 */
export const DealerPublicProfile = z.object({
  slug: z.string(),
  brandName: z.string(),
  legalName: z.string(),
  initials: z.string(),
  isVerified: z.boolean(),
  about: z.string().nullable(),
  services: z.array(z.string()),
  address: z.object({
    line: z.string().nullable(),
    city: z.string(),
    district: z.string().nullable(),
    state: z.string(),
    pincode: z.string().nullable(),
    full: z.string(),
    /**
     * The dealer's own Google Maps link, verbatim (**R6**) — the portfolio's
     * "Get directions" is an anchor to this and nothing else.
     *
     * ── Deliberate divergence from the baseline ─────────────────────────────
     * The baseline composed `https://…/dir/?api=1&destination={lat},{lng}`
     * from coordinates copied off a `cities` row. Those coordinates were the
     * town's, not the yard's, and **D6** took the row away. Null on
     * dealerships that predate the question, which is what the page branches
     * on: the button is absent rather than broken, and an address string must
     * never be turned into a Maps URL as a fallback — a typed address is
     * several pins in one district, and the wrong one sends a buyer to
     * somebody else's gate.
     * ────────────────────────────────────────────────────────────────────────
     */
    mapsUrl: z.string().nullable(),
  }),
  stats: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })),
  contact: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.string(),
      masked: z.boolean().optional(),
      mono: z.boolean().optional(),
    }),
  ),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  seo: z.object({ canonical: z.string(), title: z.string(), isIndexable: z.boolean() }),
});
export type DealerPublicProfile = z.infer<typeof DealerPublicProfile>;
